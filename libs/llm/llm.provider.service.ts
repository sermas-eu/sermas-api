import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MonitorService } from 'libs/monitor/monitor.service';
import { hash, uuidv4 } from 'libs/util';
import { Transform } from 'stream';
import {
  AvatarChat,
  LLMChatRequest,
  LLMParallelResult,
  LLMSendArgs,
  LLMToolsArgs,
} from './llm.provider.dto';
import { convertToolsToPrompt, toolsPrompt } from './prompt/prompt.tools';
import { AntrophicChatProvider } from './providers/antrophic/antrophic.chat.provider';
import { LLMChatProvider } from './providers/chat.provider';
import { LLMEmbeddingProvider } from './providers/embeddings.provider';
import { GroqChatProvider } from './providers/groq/groq.provider';
import { MistralChatProvider } from './providers/mistral/mistral.chat.provider';
import { MistralEmbeddingProvider } from './providers/mistral/mistral.embeddings.provider';
import { OllamaEmbeddingProvider } from './providers/ollama/ollama.embeddings.provider';
import { OllamaChatProvider } from './providers/ollama/ollama.provider';
import { OpenAIChatProvider } from './providers/openai/openai.chat.provider';
import { OpenAIEmbeddingProvider } from './providers/openai/openai.embeddings.provider';
import {
  LLMCallResult,
  LLMEmbeddingConfig,
  LLMMessage,
  LLMPromptTag,
  LLMProvider,
  LLMProviderConfig,
  LLMProviderList,
} from './providers/provider.dto';
import { LogTransformer } from './stream/log.transformer';
import { SentenceTransformer } from './stream/sentence.transformer';
import { ToolWithAnswerTransformer } from './stream/tool-with-answer.transformer';
import { readResponse } from './stream/util';
import { AnswerResponse, SelectedTool, ToolResponse } from './tools/tool.dto';

export const chatModelsDefaults: { [provider: LLMProvider]: string } = {
  openai: 'gpt-4o',
  ollama: 'mistral:latest',
  groq: 'mixtral-8x7b-32768',
  mistral: 'open-mixtral-8x22b',
};

export const embeddingsModelsDefaults: { [provider: LLMProvider]: string } = {
  openai: 'text-embedding-3-small',
  ollama: 'nomic-embed-text:latest',
  mistral: 'mistral-embed',
};

@Injectable()
export class LLMProviderService implements OnModuleInit {
  private readonly logger = new Logger(LLMProviderService.name);

  private readonly chatProviders: { [key: string]: LLMChatProvider } = {};
  private readonly embeddingsProviders: {
    [key: string]: LLMEmbeddingProvider;
  } = {};

  private printPrompt = false;
  private printResponse = false;

  constructor(
    private readonly config: ConfigService,
    private readonly emitter: EventEmitter2,

    private readonly monitor: MonitorService,
  ) {
    this.printPrompt = this.config.get('LLM_PRINT_PROMPT') === '1';
    this.printResponse = this.config.get('LLM_PRINT_RESPONSE') === '1';
  }

  onModuleInit() {
    this.listModels().catch((e) => {
      this.logger.warn(`Failed to list LLM models: ${e.stack}`);
    });
  }

  extractProviderName(service: string) {
    const data: { provider: string; model: string } = {
      provider: undefined,
      model: undefined,
    };
    if (!service) return data;
    const parts = service.split('/');
    if (parts.length) {
      data.provider = parts[0];
      if (parts[1]) data.model = parts[1];
    }
    return data;
  }

  getDefaultChatProviderModel(provider: LLMProvider) {
    return (
      this.config.get(`${provider.toUpperCase()}_MODEL`) ||
      chatModelsDefaults[provider]
    );
  }

  getDefaultChatProvider(): LLMProvider {
    return this.config.get<LLMProvider | undefined>('LLM_SERVICE') || 'openai';
  }

  getChatServiceByTag(task: LLMPromptTag): string[] {
    const defaultService = this.config.get('LLM_SERVICE_' + task.toUpperCase());

    let defaultProvider: string = undefined,
      defaultModel: string = undefined;

    if (defaultService) {
      const parts = defaultService.split('/');
      defaultProvider = parts[0];
      defaultModel = parts[1];
    }
    return [defaultProvider, defaultModel];
  }

  getAvalableModels(provider: LLMProvider): string[] | undefined {
    const list = this.config.get(`${provider.toUpperCase()}_CHAT_MODELS`);
    if (!list) return undefined;
    return list.split(',').map((m) => m.trim());
  }

  getDefaultEmbeddingProvider(): LLMProvider {
    return (
      this.config.get<LLMProvider | undefined>('LLM_EMBEDDINGS_SERVICE') ||
      'openai'
    );
  }

  private createProviderId(prefix: string, config: LLMProviderConfig) {
    const providerId = hash(
      (prefix || '') +
        config.provider +
        (config.baseURL || '') +
        (config.apiKey || '') +
        (config.model || ''),
    );
    return providerId;
  }

  async getChatProvider(userConfig: LLMProviderConfig) {
    const config: LLMProviderConfig = { ...userConfig };

    if (!config.provider) {
      if (config.tag) {
        const [tagProvider, tagModel] = this.getChatServiceByTag(config.tag);
        if (tagProvider) {
          config.provider = tagProvider;
          config.model = tagModel;
          this.logger.verbose(
            `Using LLM provider ${tagProvider}/${tagModel} for tag ${config.tag}`,
          );
        }
      }

      if (!config.provider) {
        config.provider = this.getDefaultChatProvider();
        config.model = this.getDefaultChatProviderModel(config.provider);
        this.logger.verbose(
          `No LLM provider selected, using defaults for ${config.provider}`,
        );
        config.model = undefined;
      }

      config.apiKey = undefined;
      config.baseURL = undefined;
    }

    const providerId = this.createProviderId('chat', config);
    if (this.chatProviders[providerId]) return this.chatProviders[providerId];

    let provider: LLMChatProvider;
    const model =
      config.model || this.getDefaultChatProviderModel(config.provider);

    const availableModels = this.getAvalableModels(config.provider);

    switch (config.provider) {
      case 'ollama':
        provider = new OllamaChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('OLLAMA_URL'),
          model,
          apiKey: config.apiKey || '',
          availableModels,
        });
        break;
      case 'openai':
        provider = new OpenAIChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('OPENAI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('OPENAI_API_KEY'),
          availableModels,
        });
        break;

      case 'mistral':
        provider = new MistralChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('MISTRAL_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('MISTRAL_API_KEY'),
          availableModels,
        });
        break;

      case 'groq':
        provider = new GroqChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('GROQ_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('GROQ_API_KEY'),
          availableModels,
        });
        break;

      case 'antrophic':
        provider = new AntrophicChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('ANTROPHIC_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('ANTROPHIC_API_KEY'),
          availableModels,
        });
        break;
    }
    if (!provider) throw new Error(`LLM provider ${config.provider} not found`);

    const valid = await provider.checkModel(model);
    if (!valid) {
      throw new Error(
        `Model ${model} is not available from provider ${config.provider}`,
      );
    }

    this.logger.verbose(
      `Initialized LLM provider provider=${config.provider} model=${model}`,
    );
    this.chatProviders[providerId] = provider;
    return provider;
  }

  async listModels() {
    return (
      await Promise.all(
        LLMProviderList.map(async (provider) => {
          try {
            const instance = await this.getChatProvider({
              provider,
            });

            const avail = await instance.available();
            this.logger.debug(
              `${instance.getName()} ${avail ? '' : 'not '}available.`,
            );
            if (!avail) return [];

            const models = await instance.getModels();
            return models.map((model) => `${provider}/${model}`);
          } catch (e) {
            this.logger.warn(
              `Failed to fetch model for ${provider}: ${e.message}`,
            );
            return [];
          }
        }),
      )
    ).flat();
  }

  async getEmbeddingsProvider(userConfig: LLMEmbeddingConfig) {
    const config: LLMEmbeddingConfig = { ...userConfig };

    if (!config.provider) {
      config.provider = config.provider || this.getDefaultEmbeddingProvider();
      this.logger.verbose(
        `No LLM embeddings provider selected, using defaults for ${config.provider}`,
      );
      config.model = undefined;
      config.apiKey = undefined;
      config.baseURL = undefined;
    }

    const providerId = this.createProviderId('emb', config);
    if (this.embeddingsProviders[providerId])
      return this.embeddingsProviders[providerId];

    let provider: LLMEmbeddingProvider;
    let model: string;

    const binaryQuantization =
      config.binaryQuantization !== undefined
        ? config.binaryQuantization
        : this.config.get('LLM_EMBEDDINGS_BINARY_QUANTIZATION') === '1' ||
          false;

    switch (config.provider) {
      case 'openai':
        model =
          config.model ||
          this.config.get('OPENAI_EMBEDDINGS_MODEL') ||
          embeddingsModelsDefaults.openai;

        provider = new OpenAIEmbeddingProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('OPENAI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('OPENAI_API_KEY'),
          binaryQuantization,
        });
        break;
      case 'ollama':
        model =
          config.model ||
          this.config.get('OLLAMA_EMBEDDINGS_MODEL') ||
          embeddingsModelsDefaults.ollama;

        provider = new OllamaEmbeddingProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('OLLAMA_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('OLLAMA_API_KEY'),
          binaryQuantization,
        });
        break;
      case 'mistral':
        model =
          config.model ||
          this.config.get('MISTRAL_EMBEDDINGS_MODEL') ||
          embeddingsModelsDefaults.mistral;

        provider = new MistralEmbeddingProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('MISTRAL_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('MISTRAL_API_KEY'),
          binaryQuantization,
        });
        break;
    }
    if (!provider)
      throw new Error(`LLM embeddings provider ${config.provider} not found`);

    const valid = await provider.checkModel(model);
    if (!valid) {
      throw new Error(
        `Embedding model ${model} is not available from provider ${config.provider}`,
      );
    }

    this.logger.debug(
      `Initialized LLM embeddings provider=${config.provider} model=${model}`,
    );
    this.embeddingsProviders[providerId] = provider;
    return provider;
  }

  outputPrompt(prompt: string, llmCallId?: string) {
    if (!this.printPrompt) return;
    this.logger.debug(`PROMPT ${llmCallId || ''} [`);
    prompt
      .split('\n')
      .map((part) => this.logger.debug(`PROMPT ${llmCallId || ''} | ${part}`));
    this.logger.debug(`PROMPT ${llmCallId || ''} ]`);
  }

  // createDefaultPrompt(data: LLMPromptArgs): string {
  //   const prompt = new ChatPrompt(data).toString();
  //   this.outputPrompt(prompt, data.llmCallId);
  //   return prompt;
  // }

  // async createModelPrompt(
  //   args: LLMChatArgs,
  //   provider: LLMChatProvider,
  //   promptArgs: LLMPromptArgs,
  // ) {
  //   const config = await provider.getConfig();
  //   if (config.model && provider.getAdapter(config.model)?.createPrompt) {
  //     return provider.getAdapter(config.model)?.createPrompt(promptArgs);
  //   }
  //   return this.createDefaultPrompt(promptArgs);
  // }

  async embeddings(text: string | string[], args?: LLMEmbeddingConfig) {
    const provider = await this.getEmbeddingsProvider(args);

    const perf = this.monitor.performance({
      label: 'embeddings',
    });
    const embeddings = await provider.generate(text);

    const config = await provider.getConfig();

    perf(`${provider.getName()}/${config.model}`);

    return embeddings;
  }

  private emptyResponse(args: {
    stream?: boolean;
    json?: boolean;
  }): LLMCallResult | string | null {
    return args.stream
      ? ({
          stream: undefined,
        } as LLMCallResult)
      : args.json
        ? null
        : ('' as string);
  }

  // send(args: LLMSendArgs & { stream: false; json: false }): Promise<string>;
  // send<T = any>(
  //   args: LLMSendArgs & { stream: false; json: true },
  // ): Promise<T | null>;
  // send(args: LLMSendArgs & { stream: true }): Promise<LLMCallResult>;
  async send<T = any>(
    args: LLMSendArgs,
  ): Promise<LLMCallResult | T | string | null> {
    let provider: LLMChatProvider;
    try {
      provider = await this.getChatProvider(args);
      // set provider/model configuration if not set
    } catch (e: any) {
      this.logger.error(
        `Failed to initialize provider ${args.provider}: ${e.message}`,
      );
      this.logger.debug(e.stack);
      return this.emptyResponse(args);
    }

    const llmCallId = uuidv4().split('-').shift();

    const config = await provider.getConfig();
    const perf = this.monitor.performance({
      label: `llm.${args.stream ? 'stream' : 'no-stream'}`,
    });

    const messages = args.messages || [];

    try {
      const { stream, abort } = await provider.call(messages, {
        stream: args.stream,
      });

      if (args.stream) {
        let returnStream = stream;
        // split by tools + answer

        let streamAdapter: Transform;
        if (
          config.model &&
          provider.getAdapter(config.model)?.getStreamAdapter
        ) {
          this.logger.debug(
            `Using custom stream adapter model=${config.model}`,
          );
          streamAdapter = provider.getAdapter(config.model)?.getStreamAdapter();

          returnStream = returnStream.pipe(streamAdapter);
        }

        if (this.printResponse) {
          returnStream = returnStream.pipe(new LogTransformer(llmCallId));
        }

        // add sentence transformer
        if (args.tag !== 'tools') {
          returnStream = returnStream.pipe(new SentenceTransformer());
        }

        perf(`${provider.getName()}/${config.model}`);

        return { stream: returnStream, abort } as LLMCallResult;
      }

      let response = await readResponse(stream);

      if (args.json) {
        try {
          // handle ```json
          if (response.startsWith('```')) {
            response = response.substring(3);
            if (response.substring(0, 4) === 'json') {
              response = response.substring(4);
            }
            response = response.substring(0, response.length - 3); // remove closing md tag ```
          }

          perf(`${provider.getName()}/${config.model}`);

          return JSON.parse(response) as T;
        } catch (e: any) {
          this.logger.error(`Failed to parse JSON: ${e.message}`);
          this.logger.debug(`RAW response: ${response}`);

          return this.emptyResponse(args);
        }
      }

      perf(`${provider.getName()}/${config.model}`);

      return response;
    } catch (e) {
      this.logger.error(`Provider ${provider.getName()} error: ${e.message}`);
      this.logger.debug(e.stack);

      return this.emptyResponse(args);
    }
  }

  chat(
    args: LLMChatRequest & { stream: true; json?: false | undefined },
  ): Promise<LLMCallResult>;
  chat<T = any>(
    args: LLMChatRequest & { stream?: false | undefined; json: true },
  ): Promise<T | null>;
  chat(
    args: LLMChatRequest & { json: false; stream?: boolean | undefined },
  ): Promise<string>;
  chat<T = any>(
    args: LLMChatRequest & { json?: true; stream?: boolean | undefined },
  ): Promise<T | null>;
  chat<T = any>(
    args: LLMChatRequest,
  ): Promise<LLMCallResult | T | string | null>;
  async chat<T = any>(
    args: LLMChatRequest,
  ): Promise<LLMCallResult | T | string | null> {
    const perf = this.monitor.performance({ label: 'chat' });
    const messages: LLMMessage[] = args.messages || [];

    // add system message
    if (args.system) {
      // const content = await this.createModelPrompt(args, provider, {
      //   system: args.system,
      //   params: args.params,
      //   llmCallId,
      // });

      // if (content) {
      messages.push({
        role: 'system',
        content: args.system,
      });
      // }
    }

    // create user message
    if (args.user) {
      // const content = await this.createModelPrompt(args, provider, {
      //   ...args,
      //   system: undefined,
      //   llmCallId,
      // });
      // if (content) {
      messages.push({
        role: 'user',
        content: args.user,
      });
      // }
    }

    if (!messages) {
      this.logger.debug(`No chat messages provided`);
      perf();
      return null;
    }

    const isStream = args.stream === undefined ? true : false;
    const isJson = !isStream && args.json === undefined ? false : true;

    const res = await this.send<T>({
      tag: 'chat',
      messages,
      stream: isStream,
      json: isJson,
      ...args,
    });

    if (!isStream) {
      perf();
      return res;
    }

    perf();
    return res as LLMCallResult;
  }

  async tools(args: LLMToolsArgs): Promise<LLMCallResult> {
    const perf = this.monitor.performance({ label: 'tools' });
    const tools = args.tools || [];

    if (!tools.length) {
      this.logger.debug(`Skip call for empty tools list`);
      perf();
      return this.emptyResponse({ stream: true }) as LLMCallResult;
    }

    const req = await this.send({
      tag: 'tools',
      stream: true,
      json: false,
      messages: [
        {
          role: 'user',
          content: toolsPrompt({
            tools: convertToolsToPrompt(tools),
          }),
        },
      ],
    });

    const res = req as LLMCallResult;

    if (res.stream) {
      res.stream = res.stream
        .pipe(new ToolWithAnswerTransformer(tools))
        .pipe(new SentenceTransformer());
    }

    const { stream, abort } = res;
    let toolsFound: boolean | undefined = undefined;

    return new Promise<LLMParallelResult>((resolve, reject) => {
      if (stream === null) return reject();

      let gotToolsResponse = false;
      // fail if tools does not provide response
      setTimeout(() => {
        if (!gotToolsResponse) {
          perf();
          reject();
        }
      }, 1000);

      stream.on('data', (res: ToolResponse | AnswerResponse) => {
        // console.warn(res);

        gotToolsResponse = true;

        if (toolsFound !== undefined) return;
        toolsFound = res.type === 'tools' && res.data && res.data.length > 0;
        if (toolsFound) {
          // console.log('tools', JSON.stringify(res, null, 2));
          resolve({
            tools: res.data as SelectedTool[],
            stream,
            abort,
          });
          perf();
        } else {
          reject();
          abort && abort();
          perf();
        }
      });
    });
  }

  // parallelize calls to tools and chat.
  // if tools are found, return the tools stream
  // otherwise return the plain chat response
  // NOTE it creates 2x the call to the provider(s)
  async avatarChat(args: AvatarChat): Promise<LLMParallelResult> {
    const perf = {
      tools: this.monitor.performance({ label: 'tools' }),
      chat: this.monitor.performance({ label: 'chat' }),
    };

    const chatProvider = args.chatArgs?.provider || args.provider;
    const chatModel = args.chatArgs?.model || args.model;

    const toolProvider = args.toolsArgs?.provider || args.provider;
    const toolModel = args.toolsArgs?.model || args.model;

    const results = await Promise.allSettled([
      args.tools && args.tools.length
        ? this.tools({
            tools: args.tools,
            provider: toolProvider,
            model: toolModel,
          }).then((res) => {
            if (!res) return Promise.reject();

            const { stream, abort } = res;
            let toolsFound: boolean | undefined = undefined;
            return new Promise<LLMParallelResult>((resolve, reject) => {
              if (stream === null) return reject();

              let gotToolsResponse = false;
              // fail if tools does not provide response
              setTimeout(() => {
                if (!gotToolsResponse) reject();
              }, 1000);

              stream.on('data', (res: ToolResponse | AnswerResponse) => {
                // console.warn(res);

                gotToolsResponse = true;

                if (toolsFound !== undefined) return;
                toolsFound =
                  res.type === 'tools' && res.data && res.data.length > 0;
                if (toolsFound) {
                  // console.log('tools', JSON.stringify(res, null, 2));
                  resolve({
                    tools: res.data as SelectedTool[],
                    stream,
                    abort,
                  });
                } else {
                  reject();
                  abort && abort();
                }
              });
            });
          })
        : Promise.reject(),
      args.skipChat !== true
        ? this.chat({
            tag: 'chat',
            provider: chatProvider,
            model: chatModel,
            stream: true,
            json: false,
            // TODO missing params
          }).then((res: LLMCallResult) => {
            if (!res) return Promise.reject();
            if (res.stream === null) return Promise.reject();
            return Promise.resolve(res);
          })
        : Promise.reject(),
    ]);

    const [toolsPromise, chatPromise] = results;

    const chatResult =
      chatPromise.status === 'fulfilled' ? chatPromise.value : undefined;
    const selectedTools =
      toolsPromise.status === 'fulfilled' ? toolsPromise.value : undefined;

    if (selectedTools) {
      chatResult?.abort && chatResult?.abort();
      perf.tools('tools', true);
      return selectedTools;
    }

    if (chatResult) {
      perf.chat('chat', true);
      return { stream: chatResult.stream, abort: chatResult.abort };
    }

    return { tools: undefined, stream: undefined };
  }
}

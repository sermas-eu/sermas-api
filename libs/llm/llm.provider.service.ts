import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MonitorService } from 'libs/monitor/monitor.service';
import { hash } from 'libs/util';
import { Readable } from 'stream';
import { ulid } from 'ulidx';
import { LLMCacheService, SaveToCacheTransformer } from './llm.cache.service';
import {
  LLMChatRequest,
  LLMResultEvent,
  LLMSendArgs,
} from './llm.provider.dto';
import { SessionContextHandler } from './llm.session-context.handler';
import {
  PromptTemplate,
  PromptTemplateOutput,
  PromptTemplateParams,
} from './prompt/prompt.template';
import { AntrophicChatProvider } from './providers/antrophic/antrophic.chat.provider';
import { AzureOpenAIChatProvider } from './providers/azure-openai/azure-openai.chat.provider';
import { AzureOpenAIEmbeddingProvider } from './providers/azure-openai/azure-openai.embeddings.provider';
import { LLMChatProvider } from './providers/chat.provider';
import { LLMEmbeddingProvider } from './providers/embeddings.provider';
import { GeminiChatProvider } from './providers/gemini/gemini.chat.provider';
import { GeminiEmbeddingProvider } from './providers/gemini/gemini.embeddings.provider';
import { GroqChatProvider } from './providers/groq/groq.provider';
import { HuggingfaceChatProvider } from './providers/huggingface/huggingface.chat.provider';
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
  LLMProvider,
  LLMProviderConfig,
  LLMProviderList,
} from './providers/provider.dto';
import { LogTransformer } from './stream/log.transformer';
import { TextTransformer } from './stream/text-transformer.stream';
import { readResponse } from './stream/util';
import { extractProviderName, parseJSON } from './util';
import { VertexAIChatProvider } from './providers/vertexai/vertexai.chat.provider';
import { GCPMistralChatProvider } from './providers/gcp-mistral/gcp-mistral.chat.provider';

export const chatModelsDefaults: { [provider: LLMProvider]: string } = {
  openai: 'gpt-4o',
  ollama: 'mistral:latest',
  groq: 'mixtral-8x7b-32768',
  mistral: 'open-mixtral-8x22b',
  gemini: 'gemini-1.5-flash',
  huggingface: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  azure_openai: 'gpt-4o',
  gcp_mistral: 'mistral-small-2503',
};

export const embeddingsModelsDefaults: { [provider: LLMProvider]: string } = {
  openai: 'text-embedding-3-small',
  ollama: 'nomic-embed-text:latest',
  mistral: 'mistral-embed',
  gemini: 'text-embedding-004',
  azure_openai: 'text-embedding-ada-002',
};

@Injectable()
export class LLMProviderService implements OnModuleInit {
  private readonly logger = new Logger(LLMProviderService.name);

  private readonly LLMLogger = new Logger('LLM');

  private readonly chatProviders: { [key: string]: LLMChatProvider } = {};
  private readonly embeddingsProviders: {
    [key: string]: LLMEmbeddingProvider;
  } = {};

  private printPrompt = false;
  private printResponse = false;

  private sessionContextHandler?: SessionContextHandler | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly emitter: EventEmitter2,

    private readonly monitor: MonitorService,
    private readonly cache: LLMCacheService,
  ) {
    this.printPrompt = this.config.get('LLM_PRINT_PROMPT') === '1';
    this.printResponse = this.config.get('LLM_PRINT_RESPONSE') === '1';
  }

  onModuleInit() {
    this.listModels().catch((e) => {
      this.logger.warn(`Failed to list LLM models: ${e.stack}`);
    });
  }

  public setSessionContextHandler(handler: SessionContextHandler) {
    this.sessionContextHandler = handler;
  }

  extractProviderName(service: string) {
    const data: { provider: string; model: string } = {
      provider: undefined,
      model: undefined,
    };
    if (!service) return data;
    const parts = service.split('/');
    if (parts.length) {
      data.provider = parts.shift();
      if (parts.length) data.model = parts.join('/');
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

  async getChatServiceByTag(
    config: LLMSendArgs | LLMProviderConfig,
  ): Promise<string[]> {
    const defaultService = this.config.get(
      'LLM_SERVICE_' + config.tag.toUpperCase(),
    );

    let provider: string = undefined,
      model: string = undefined;

    const llmSendArgs = config as LLMSendArgs;
    if (this.sessionContextHandler && llmSendArgs.sessionContext) {
      try {
        const service =
          await this.sessionContextHandler.getChatServiceByTag(llmSendArgs);
        if (service) {
          const parts = service.split('/');
          if (parts.length === 2) {
            provider = parts[0];
            model = parts[1];
          }
        }
      } catch (e) {
        this.logger.warn(
          `Failed to get LLM provider service from tag: ${e.message}`,
        );
        this.logger.verbose(e.stack);
      }
    }

    if (defaultService && (!provider || !model)) {
      const parts = defaultService.split('/');
      provider = parts[0];
      model = parts[1];
    }

    return [provider, model];
  }

  getAllowedModels(provider: LLMProvider): string[] | undefined {
    const configKey: string = `${provider.toUpperCase()}_CHAT_MODELS`;
    const list = this.config.get(configKey);
    this.logger.verbose(
      `Retrieved configured models for ${configKey}: ${list}`,
    );
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

  async getChatProvider(userConfig: LLMSendArgs | LLMProviderConfig) {
    const config: LLMProviderConfig = { ...userConfig };

    if (!config.provider) {
      if (config.tag) {
        const [tagProvider, tagModel] = await this.getChatServiceByTag(config);
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
        this.logger.verbose(
          `No LLM provider selected, using defaults for ${config.provider}`,
        );
        config.model = undefined;
      }

      config.apiKey = undefined;
      config.baseURL = undefined;
    }

    const providerId = this.createProviderId('chat', config);
    if (this.chatProviders[providerId]) {
      this.logger.verbose(
        `Cached provider instance provider=${this.chatProviders[providerId].getName()}`,
      );
      return this.chatProviders[providerId];
    }

    let provider: LLMChatProvider;
    const model =
      config.model || this.getDefaultChatProviderModel(config.provider);

    const availableModels = this.getAllowedModels(config.provider);

    this.logger.debug(
      `Using ${config.provider}/${config.model || model || 'unknown'}`,
    );

    switch (config.provider) {
      case 'ollama':
        provider = new OllamaChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('OLLAMA_BASEURL'),
          model,
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
      case 'azure_openai':
        provider = new AzureOpenAIChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('AZURE_OPENAI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('AZURE_OPENAI_API_KEY'),
          availableModels,
          apiVersion:
            config.apiVersion ||
            this.config.get('AZURE_OPENAI_CHAT_API_VERSION'),
        });
        break;
      case 'gemini':
        provider = new GeminiChatProvider({
          provider: config.provider,
          // baseURL: config.baseURL || this.config.get('GEMINI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('GEMINI_API_KEY'),
          availableModels,
        });
        break;
      case 'huggingface':
        provider = new HuggingfaceChatProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('HUGGINGFACE_BASEURL'),
          model,
          apiKey:
            config.apiKey ||
            this.config.get('HUGGINGFACE_API_KEY') ||
            this.config.get('HF_TOKEN'),
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
      case 'gcp_mistral':
        provider = new GCPMistralChatProvider({
          // No need to pass the API key: authentication uses the service account at GOOGLE_APPLICATION_CREDENTIALS
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('GCP_MISTRAL_BASEURL'),
          model,
          availableModels,
          region: this.config.get('GCP_MISTRAL_REGION'),
          project: this.config.get('GCP_MISTRAL_PROJECT'),
        });
        break;
      case 'vertexai':
        provider = new VertexAIChatProvider({
          provider: config.provider,
          model,
          apiKey: config.apiKey || this.config.get('VERTEXAI_API_KEY'),
          availableModels,
          region: this.config.get('VERTEXAI_REGION'),
          project: this.config.get('VERTEXAI_PROJECT'),
        });
        break;
    }
    if (!provider) {
      this.logger.warn(`LLM provider ${config.provider} not found`);
      return null;
    }

    const available = await provider.available();
    if (!available) {
      return null;
    }

    const valid = await provider.checkModel(model);
    if (!valid) {
      const providerModels = await provider.getModels();
      throw new Error(
        `Model ${model} is not available from provider ${config.provider}. ` +
          `Available models are: ${providerModels}`,
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

            if (!instance) {
              this.logger.verbose(`${provider} is not configured`);
              return [];
            }

            const avail = await instance.available();

            this.logger[avail ? 'debug' : 'verbose'](
              `${instance.getName()} ${avail ? '' : 'not '}available.`,
            );

            if (!avail) return [];

            const models = await instance.getModels();
            return (models || []).map((model) => `${provider}/${model}`);
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
      case 'azure_openai':
        model =
          config.model ||
          this.config.get('AZURE_OPENAI_EMBEDDINGS_MODEL') ||
          embeddingsModelsDefaults.openai;

        provider = new AzureOpenAIEmbeddingProvider({
          provider: config.provider,
          baseURL: config.baseURL || this.config.get('AZURE_OPENAI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('AZURE_OPENAI_API_KEY'),
          binaryQuantization,
          apiVersion:
            config.apiVersion ||
            this.config.get('AZURE_OPENAI_EMBEDDINGS_API_VERSION'),
        });
        break;
      case 'gemini':
        model =
          config.model ||
          this.config.get('GEMINI_EMBEDDINGS_MODEL') ||
          embeddingsModelsDefaults.gemini;

        provider = new GeminiEmbeddingProvider({
          provider: config.provider,
          // baseURL: config.baseURL || this.config.get('GEMINI_BASEURL'),
          model,
          apiKey: config.apiKey || this.config.get('GEMINI_API_KEY'),
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

  logPrompt(messages: LLMMessage[], llmCallId?: string) {
    if (!this.printPrompt) return;
    messages.forEach((m) => {
      const { role, content } = m;
      this.LLMLogger.debug(`PROMPT ${llmCallId || ''} ${role} |---`);
      content
        .split('\n')
        .map((part) =>
          this.LLMLogger.debug(`PROMPT ${llmCallId || ''} ${role} | ${part}`),
        );
      this.LLMLogger.debug(`PROMPT ${llmCallId || ''} ${role} |---`);
    });
  }

  logResponse(response: string, llmCallId: string) {
    if (!this.printResponse) return;
    this.LLMLogger.debug(`RES ${llmCallId} |---`);
    response
      .split('\n')
      .forEach((m) => this.LLMLogger.debug(`RES ${llmCallId} | ${m}`));
    this.LLMLogger.debug(`RES ${llmCallId} |---`);
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
      label: 'llm.embeddings',
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

  private emit(context: LLMResultEvent) {
    this.emitter.emit(`llm.result`, context);
  }

  private applyTransformers(
    args: LLMSendArgs,
    returnStream: Readable,
    onStreamResponse: (response: string) => void,
  ) {
    returnStream = returnStream.pipe(new LogTransformer(onStreamResponse));

    returnStream = returnStream.pipe(
      new SaveToCacheTransformer(this.cache, args.messages),
    );

    if (args.transformers) {
      for (const transformer of args.transformers) {
        returnStream = returnStream.pipe(transformer);
      }
    } else {
      returnStream = returnStream.pipe(new TextTransformer());
    }
    return returnStream;
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
      if (!provider)
        throw new Error(`Provider ${args.provider} not configured.`);

      // set provider/model configuration if not set
    } catch (e: any) {
      this.logger.error(
        `Failed to initialize provider ${args.provider}: ${e.message}`,
      );
      this.logger.debug(e.stack);
      return this.emptyResponse(args);
    }

    const llmCallId = ulid().slice(-5);

    const config = await provider.getConfig();
    const perf = this.monitor.performance({
      label: `llm.send:${args.tag ? `${args.tag}:` : ''}:${llmCallId}`,
    });

    const messages = args.messages || [];

    messages.map((m) => {
      const templateOutput = (m.content as any).template
        ? (m.content as PromptTemplateOutput)
        : null;

      if (!templateOutput) return m;

      //
      const params: PromptTemplateParams = {
        provider: provider.getName(),
        model: config.model,
      };

      const promptTemplate = templateOutput.getPromptTemplate();

      this.logger.debug(
        `Rendering LLM prompt template ${promptTemplate.getTemplateName()} for ${promptTemplate.getName()}`,
      );

      if (
        !PromptTemplate.exists({
          ...params,
          name: promptTemplate.getName(),
        })
      ) {
        return m;
      }

      this.logger.debug(
        `Rendering overridden prompt template ${provider.getName()}/${config.model}/${promptTemplate.getName()}`,
      );
      return {
        ...m,
        content: promptTemplate.render(promptTemplate.getArgs(), params),
      };
    });

    this.logPrompt(messages, llmCallId);

    const onStreamResponse = (response: string) => {
      // print to screen
      if (this.printResponse) {
        this.logger.debug(`${llmCallId || ''} |---`);
        response
          .split('\n')
          .forEach((line) => this.logger.debug(`${llmCallId || ''} | ${line}`));
        this.logger.debug(`${llmCallId || ''} |---`);
      }
      // emit result
      this.emit({
        model: config.model,
        provider: provider.getName(),
        params: args.messages,
        messages,
        response,
        tag: args.tag,
        llmCallId,
      });
    };

    const cached = await this.cache.get(args.messages);
    if (cached) {
      this.logger.debug(`Using cached response`);
      this.logger.verbose(
        `Cached message:\n${JSON.stringify(args.messages)}\nresponse:\n${cached}`,
      );
      if (args.stream) {
        const returnStream = this.applyTransformers(
          args,
          Readable.from(cached.toString()),
          onStreamResponse,
        );
        return { stream: returnStream } as LLMCallResult;
      } else {
        this.logResponse(JSON.stringify(cached), llmCallId);
        return cached as T;
      }
    }

    try {
      const { stream, abort } = await provider.call(messages, {
        stream: args.stream,
      });

      if (args.stream) {
        let returnStream = stream;

        // custom stream handler, eg. sermas-llama3, sermas-llama2
        // if (
        //   config.model &&
        //   provider.getAdapter(config.model)?.getStreamAdapter
        // ) {
        //   this.logger.debug(
        //     `Using custom stream adapter model=${config.model}`,
        //   );
        //   const streamAdapter = provider
        //     .getAdapter(config.model)
        //     ?.getStreamAdapter();
        //   returnStream = returnStream.pipe(streamAdapter);
        // }

        returnStream = this.applyTransformers(
          args,
          returnStream,
          onStreamResponse,
        );

        perf(`${provider.getName()}/${config.model}`);

        return { stream: returnStream, abort } as LLMCallResult;
      }

      const response = await readResponse(stream);
      this.logResponse(response, llmCallId);

      this.emit({
        model: config.model,
        provider: provider.getName(),
        params: args.messages,
        messages,
        response,
        tag: config.tag,
        llmCallId,
      });

      if (args.json) {
        const result = parseJSON<T>(response);

        if (result === null) {
          return this.emptyResponse(args);
        }

        //cache response
        await this.cache.save(args.messages, result);

        return result as T;
      }

      perf(`${provider.getName()}/${config.model}`);

      //cache response
      await this.cache.save(args.messages, response);

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
    const perf = this.monitor.performance({
      label: `llm.chat${args.tag ? `:${args.tag}` : ''}`,
      threshold: 1800,
    });
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
      tag: args.tag || 'chat',
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
}

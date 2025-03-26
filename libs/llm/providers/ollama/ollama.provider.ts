import { Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import {
  LLMCallResult,
  LLMChatOptions,
  LLMMessage,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatRequest, ChatResponse, Message, Ollama } from 'ollama';
import { AbortableAsyncIterator } from 'ollama/src/utils';
import { ChatMessageStream } from '../../stream/chat-message.stream';
import { LLMModelAdapter } from '../adapter';
import { LLMChatProvider } from '../chat.provider';
import { TudaLLama2ModelAdapter } from './adapters/tuda-llama2/tuda.llama2.adapter';
import { TudaLLama3ModelAdapter } from './adapters/tuda-llama3/tuda.llama3.adapter';

const OLLAMA_TIMEOUT = 2000;

type OllamaModel = {
  name: string;
  family: string;
};

export class OllamaChatProvider
  extends LLMChatProvider
  implements OnModuleInit
{
  private logger = new Logger(OllamaChatProvider.name);
  private readonly ollama: Ollama;

  protected modelsList: OllamaModel[] = [];

  protected adapters: { [key: string]: LLMModelAdapter } = {
    'sermas-llama2:latest': new TudaLLama2ModelAdapter(),
    'sermas-llama3:*': new TudaLLama3ModelAdapter(),
  };

  private reachable: boolean | undefined;
  private heartbeat: NodeJS.Timeout;
  // private available: boolean | undefined;

  constructor(protected config: LLMProviderConfig) {
    super(config);
    this.ollama = this.createClient();
  }

  getName(): string {
    return 'ollama';
  }

  async onModuleInit() {
    // this.available = await this.isOllamaReachable();
  }

  private async listModels(cached = true): Promise<OllamaModel[]> {
    // check if avail
    const avail = await this.available();
    if (!avail) return [];

    try {
      const res = await this.ollama.list();

      if (!cached || !this.modelsList.length) {
        this.modelsList = res.models.map(({ name, details }) => ({
          name,
          family: details.family,
        }));
      }

      return this.modelsList;
    } catch (e) {
      this.logger.warn(`ollama.listModels failed: ${e.message}`);
      return this.modelsList || [];
    }
  }

  private async isOllamaReachable(): Promise<boolean> {
    if (!this.config.baseURL) {
      this.logger.debug('ollama unreachable: no baseURL provided');
      return false;
    }
    let res: any;
    try {
      res = await axios.get(this.config.baseURL, {
        timeout: OLLAMA_TIMEOUT,
      });
    } catch (e) {
      this.logger.verbose(
        `ollama unreachable: error connecting to ${this.config.baseURL}. ${e.message}}`,
      );
      return false;
    }
    if (!res) {
      this.logger.verbose(
        `ollama unreachable: no response from ${this.config.baseURL}`,
      );
      return false;
    }
    return true;
  }

  async available(): Promise<boolean> {
    // // check periodically
    // if (!this.heartbeat) {
    //   this.heartbeat = setInterval(async () => {
    //     try {
    //       this.reachable = await this.isOllamaReachable();
    //     } catch {
    //       this.reachable = false;
    //     }
    //   }, 5000);
    // }

    // Check the first time
    if (this.reachable === undefined) {
      this.reachable = await this.isOllamaReachable();
    }
    return this.reachable;
  }

  private createClient() {
    const { baseURL } = this.config;
    return new Ollama({
      host: baseURL,
    });
  }

  public async getModels() {
    const avail = await this.available();
    if (!avail) return [];

    if (this.models === undefined) {
      try {
        const list = await this.listModels();
        this.models = list.map((model) => model.name);
      } catch (e: any) {
        this.logger.error(`Failed to get model list ${e.stack}`);
        this.models = [];
      }
    }

    if (this.models.filter((m) => m.indexOf('*') > -1).length > 0) {
      const sources = this.models;
      const list = await this.listModels();
      const models: string[] = [];
      for (const model of sources) {
        const pos = model.indexOf('*');
        if (pos === -1) {
          models.push(model);
          continue;
        }
        const match = model.substring(0, pos);
        models.push(
          ...list.filter((m) => m.name.indexOf(match) > -1).map((m) => m.name),
        );
      }
      this.models = models;
    }

    return this.models;
  }

  async call(
    chatMessages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    const stream = new ChatMessageStream();

    const emptyResponse = () => {
      setTimeout(() => stream.close(), 100);
      return {
        stream,
        abort: () => {
          //
        },
      };
    };

    if (!this.reachable) return emptyResponse();

    const isStream = options?.stream === true || false;

    const messages: Message[] = [];

    for (const msg of chatMessages) {
      // TODO handle function
      const message: Message = {
        role: msg.role,
        content: msg.content,
      };
      messages.push(message);
    }

    // console.warn(messages);

    const ollamaOptions = {
      num_predict: 1500,
      top_p: this.config.top_p,
      temperature: this.config.temperature,
    };

    const callOllama = async (args: ChatRequest & { stream: boolean }) => {
      try {
        if (args.stream === true) {
          return await this.ollama.chat({ ...args, stream: true });
        }
        return await this.ollama.chat({ ...args, stream: false });
      } catch (e: any) {
        this.logger.error(`Ollama call failed: ${e.message}`);
      }
      return null;
    };

    if (!isStream) {
      const res = await callOllama({
        model: this.config.model,
        messages,
        stream: false,
        options: ollamaOptions,
      });

      if (res === null) {
        return emptyResponse();
      }

      const content = (res as ChatResponse).message.content;
      stream.add(content);
      stream.close();
      return {
        stream,
      };
    }

    const res = await callOllama({
      model: this.config.model,
      messages,
      stream: true,
      options: ollamaOptions,
    });

    let aborted = false;

    if (res === null) {
      return emptyResponse();
    }

    (async () => {
      for await (const part of res as unknown as AbortableAsyncIterator<ChatResponse>) {
        if (aborted || stream.closed) break;
        const chunk = part.message.content;
        stream.add(chunk);
      }
      stream.close();
    })();

    return {
      stream,
      abort: () => (aborted = true),
    };
  }
}

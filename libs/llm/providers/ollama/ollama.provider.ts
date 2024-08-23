import { Logger } from '@nestjs/common';
import axios from 'axios';
import {
  LLMCallResult,
  LLMChatMessage,
  LLMChatOptions,
  LLMProviderConfig,
} from 'libs/llm/providers/provider.dto';
import { ChatRequest, ChatResponse, Message, Ollama } from 'ollama';
import { AbortableAsyncIterator } from 'ollama/src/utils';
import { ChatMessageStream } from '../../stream/chat-message.stream';
import { LLMModelAdapter } from '../adapter';
import { LLMChatProvider } from '../chat.provider';
import { TudaLLama2ModelAdapter } from './adapters/tuda-llama2/tuda.llama2.adapter';
import { TudaLLama3ModelAdapter } from './adapters/tuda-llama3/tuda.llama3.adapter';

const OLLAMA_TIMEOUT = 1000;

type OllamaModel = {
  name: string;
  family: string;
};

export class OllamaChatProvider extends LLMChatProvider {
  private logger = new Logger(OllamaChatProvider.name);
  private readonly ollama: Ollama;

  protected modelsList: OllamaModel[] = [];

  protected adapters: { [key: string]: LLMModelAdapter } = {
    'sermas-llama2:latest': new TudaLLama2ModelAdapter(),
    'sermas-llama3:*': new TudaLLama3ModelAdapter(),
  };

  constructor(protected config: LLMProviderConfig) {
    super(config);
    this.ollama = this.createClient();
  }

  getName(): string {
    return 'ollama';
  }

  private async listModels(cached = true): Promise<OllamaModel[]> {
    const res = await this.ollama.list();

    if (!cached || !this.modelsList.length) {
      this.modelsList = res.models.map(({ name, details }) => ({
        name,
        family: details.family,
      }));
    }

    return this.modelsList;
  }

  async available(): Promise<boolean> {
    try {
      if (!this.config.baseURL) return false;
      const res = axios.get(this.config.baseURL, {
        timeout: OLLAMA_TIMEOUT,
      });
      if (!res) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  private createClient() {
    const { baseURL } = this.config;
    return new Ollama({
      host: baseURL,
    });
  }

  public async getModels() {
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
    chatMessages: LLMChatMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
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
    };

    const stream = new ChatMessageStream();
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

    const emptyResponse = () => {
      setTimeout(() => stream.close(), 100);
      return {
        stream,
        abort: () => {
          //
        },
      };
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
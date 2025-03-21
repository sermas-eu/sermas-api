import { ChatCompletion, ChatCompletionChunk, ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { OpenAIChatProvider } from '../openai/openai.chat.provider';
import { LLMCallResult, LLMChatOptions, LLMMessage } from '../provider.dto';
import { APIPromise } from 'openai/core';
import * as Core from 'openai/core';
import { Stream } from 'openai/streaming';

export class VertexAIChatProvider extends OpenAIChatProvider {
  getName(): string {
    return 'vertexai';
  }

  private patchedChatCompletionsCreate(
    body: ChatCompletionCreateParamsBase,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<ChatCompletionChunk> | ChatCompletion>{
    return this.getApiClient().chat.completions._client.post('/chat/completions', { body, ...options, stream: body.stream ?? false }) as
    | APIPromise<ChatCompletion>
    | APIPromise<Stream<ChatCompletionChunk>>;
}
  

  protected getApiClient() {
    const client = super.getApiClient();
    client.chat.completions.create = this.patchedChatCompletionsCreate;
    return client;
  }

  .chat.completions.create

  async call(
    chatMessages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMCallResult> {
    options = options || {};
    options.stream = false;
    return await super.call(chatMessages, options);
  }

  // TODO: Not sure this will work...
  // public async getModels() {
  //   if (this.models === undefined) {
  //     const models = await this.getApiClient().models.list();
  //     this.models = models.data.map((model) => model.id);
  //   }
  //   return this.models;
  // }
}

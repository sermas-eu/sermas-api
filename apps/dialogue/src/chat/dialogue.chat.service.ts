import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMBaseArgs } from 'libs/llm/llm.provider.dto';
import { extractProviderName, parseJSON } from 'libs/llm/util';
import { MonitorService } from 'libs/monitor/monitor.service';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import {
  LLMChatData,
  LLMCombinedResult,
  LLMParsedResult,
} from './dialogue.chat.dto';
import { convertToolsToPrompt, packAvatarObject } from './utils';
import {
  DialogueChatProgressEvent,
  DialogueChatValidationEvent,
} from './dialogue.chat.dto';

import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import {
  avatarChatPrompt,
  AvatarChatPromptParams,
  AvatarChatSystemPromptParams,
  avatarSystemChatPrompt,
} from './dialogue.chat.prompt';
import { SelectedTool } from './dialogue.chat.tools.dto';
import { StreamingMarkupParserTransformer } from './transformer/markup-parser.transformer';
import { SentenceTransformer } from './transformer/sentence.transformer';
import { DialogueVectorStoreService } from '../document/dialogue.vectorstore.service';
import { DialogueIntentService } from '../intent/dialogue.intent.service';
import { DialogueMemoryService } from '../memory/dialogue.memory.service';
import { convertTaskToPrompt } from '../tasks/util';

@Injectable()
export class DialogueChatService {
  private readonly logger = new Logger(DialogueChatService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
    private readonly intent: DialogueIntentService,
    private readonly memory: DialogueMemoryService,
    private readonly vectorStore: DialogueVectorStoreService,
    private readonly monitor: MonitorService,
  ) {}

  async inference(
    message: DialogueMessageDto,
    llmArgs?: { chatArgs: LLMBaseArgs; toolsArgs: LLMBaseArgs },
  ) {
    if (!llmArgs) {
      const llm = await this.session.getLLM(message.sessionId);
      llmArgs = {
        chatArgs: llm?.chat ? extractProviderName(llm?.chat) : undefined,
        toolsArgs: llm?.tools ? extractProviderName(llm?.tools) : undefined,
      };
    }

    const perf = this.monitor.performance({
      ...message,
      label: 'avatar',
      threshold: 3000,
    });

    const response = await this.send(message, llmArgs);
    perf('request');

    // handle skip case
    const validationEvent: DialogueChatValidationEvent = {
      appId: message.appId,
      sessionId: message.sessionId,
      message: message,
      skip: response?.filter?.skip,
    };
    this.emitter.emit('dialogue.chat.validation', validationEvent);

    // skip
    if (response?.filter?.explain) {
      this.logger.debug(`filter explanation: ${response?.filter?.explain}`);
    }
    if (response?.filter?.skip) {
      this.logger.debug(`Skipping user request message=${message.text}`);
      return;
    }

    // intents
    if (response?.intent) {
      if (response.intent.explain) {
        this.logger.debug(`Intent explanation: ${response.intent.explain}`);
      }

      const taskResult = await this.intent.handleTaskIntent({
        message,
        taskIntent: response.intent,
        activeTask: response.data.activeTask,
        tasks: response.data.tasks,
      });

      // skip response?
      if (taskResult.skipResponse) {
        perf('intent');
        return;
      }
    } else {
      this.logger.debug(`Intent not found for sessionId=${message.sessionId}`);
    }

    const { appId, sessionId, settings } = response.data;

    // tools
    const { skipResponse } = await this.intent.handleTools({
      appId,
      sessionId,
      text: message.text,
      settings,

      selectedTools: response.tools,
      tools: response.data.activeTools?.tools,
      repositories: response.data.activeTools?.repositories,

      currentField: response.data.currentField,
      currentTask: response.data.activeTask?.task,

      isToolExclusive: response.data.activeTools?.isToolExclusive,
      matchOrRemoveTask: response.data.activeTools?.matchOrRemoveTask,
      hasCatchAll: response.data.activeTools?.hasCatchAll,
    });

    // chat
    if (!response || !response.stream) {
      perf('no-results');
      this.logger.warn(
        `LLM response is empty appId=${appId} sessionId=${sessionId}`,
      );
      return;
    }

    const messageId = getMessageId();

    const chunkBuffer = '';

    const skipChatResponse =
      settings?.chatModeEnabled === false || skipResponse;

    if (skipChatResponse) {
      this.logger.debug(`Skipping chat response.`);
      if (response.abort) response.abort();
      return;
    }

    response.stream
      .on('data', (chunk: Buffer | string) => {
        perf('stream');

        const text = chunk.toString();

        (text || '')
          .split('\n')
          .map((text) =>
            this.logger.debug(`RESPONSE ${message.requestId} | ${text}`),
          );

        if (skipChatResponse) {
          return;
        }

        // chunkBuffer += text;

        // const minSplittingSentenceLen = 30;
        // const sentenceSplitDelimiters = ['[ ', '. ', '.\n', ': ', ':\n'];
        // let toSend = this.splitSentenceOnDelimiter(
        //   chunkBuffer,
        //   sentenceSplitDelimiters,
        //   minSplittingSentenceLen,
        // );

        // if (toSend != chunkBuffer) {
        if (text) {
          // chunkBuffer = chunkBuffer.substring(toSend.length);

          // // sometimes, somehow it starts the answer like this
          // const trimPrefixes = ['ASSISTANT:', 'USER:', 'UTENTE:'];
          // trimPrefixes.forEach((trimPrefix) => {
          //   if (toSend.startsWith(trimPrefix)) {
          //     toSend = toSend.substring(trimPrefix.length);
          //   }
          // });

          const chunkId = getChunkId();
          // this.sendMessage(message, messageId, chunkId, toSend);
          this.sendMessage(message, messageId, chunkId, text);

          this.emitChatProgress({
            completed: false,
            messageId,
            chunkId,
            sessionId,
            appId,
            requestId: message.requestId,
          });
        }
      })
      .on('end', async () => {
        if (skipChatResponse) return;

        let chunkId: string | undefined = undefined;
        if (chunkBuffer.length > 1) {
          chunkId = getChunkId();
          this.sendMessage(message, messageId, chunkId, chunkBuffer);
        }

        this.emitChatProgress({
          completed: true,
          messageId,
          chunkId,
          sessionId,
          appId,
          requestId: message.requestId,
        });

        this.logger.verbose(`chat response stream completed`);
        perf('end');
      });
  }

  private async send(
    message: DialogueMessageDto,
    args: LLMBaseArgs & { chatArgs: LLMBaseArgs; toolsArgs: LLMBaseArgs },
  ): Promise<LLMCombinedResult> {
    const chatProvider = args.chatArgs?.provider || args.provider;
    const chatModel = args.chatArgs?.model || args.model;

    const { appId, sessionId } = message;

    const settings = await this.session.getSettings(message);
    const avatar = await this.session.getAvatar(message, message.avatar);

    const knowledge = await this.vectorStore.search(appId, message.text);
    const summary = await this.memory.getSummary(sessionId);

    const activeTask = await this.intent.getActiveTaskRecord(message.sessionId);
    const currentTask = activeTask.task;

    const { tasks, intents } = await this.intent.getTaskIntentList(appId);

    // TODO check how to map those
    const suggestedTasks = currentTask ? [] : tasks;

    const activeTools = await this.intent.retrieveCurrentTools(message, {
      currentTask,
      suggestedTasks,
    });

    const currentField = await this.intent.getCurrentField(
      currentTask,
      message.sessionId,
    );

    const systemPrompParams: AvatarChatSystemPromptParams = {
      app: settings?.prompt?.text,
      avatar: packAvatarObject(avatar),
      history: summary,
      emotion: message.emotion,
      language: message.language,
      message: message.text,
      tools: convertToolsToPrompt(activeTools.tools),
      intents: currentTask ? undefined : JSON.stringify(intents),
    };

    const chatPromptParams: AvatarChatPromptParams = {
      knowledge,
      suggestedTasks: convertTaskToPrompt(suggestedTasks),
      // track current task progress
      task:
        currentTask && (currentTask.hint || currentTask.description)
          ? `${currentTask.name}: ${currentTask.hint || currentTask.description}`
          : undefined,
      field:
        currentField && currentField?.hint
          ? `${currentField?.label || currentField?.name}: ${currentField?.hint}`
          : undefined,
    };

    const llmChatData: LLMChatData = {
      data: {
        appId,
        sessionId,
        settings,
        currentField,
        activeTask,
        tasks,
        activeTools: activeTools,
      },
    };
    const llmParsedResult: LLMParsedResult = {};

    const promise = new Promise<LLMCombinedResult>(async (resolve) => {
      const result = await this.llmProvider.chat({
        tag: 'chat',
        stream: true,
        json: false,

        provider: chatProvider,
        model: chatModel,
        sessionContext: createSessionContext(message),

        system: avatarSystemChatPrompt(systemPrompParams),
        user: avatarChatPrompt(chatPromptParams),

        transformers: [
          new StreamingMarkupParserTransformer(
            'filter',
            (res: string | undefined) => {
              llmParsedResult.filter = parseJSON(res) || undefined;
            },
          ),
          new StreamingMarkupParserTransformer(
            'tools',
            (res: string | undefined) => {
              llmParsedResult.tools = this.parseMatchingTools(
                res,
                activeTools.tools,
              );
            },
          ),
          new StreamingMarkupParserTransformer(
            'intents',
            (res: string | undefined) => {
              llmParsedResult.intent = parseJSON(res) || undefined;
            },
          ),
          new SentenceTransformer(() => {
            resolve({
              ...result,
              ...llmParsedResult,
              ...llmChatData,
            });
          }),
        ],
      });
    });

    return await promise;
  }

  parseMatchingTools(rawJson: string, tools: AppToolsDTO[]) {
    if (!rawJson) return [];
    const res = parseJSON<Record<string, any>>(rawJson);

    const selectedTools: SelectedTool[] = [];

    if (!res || !Object.keys(res).length) {
      return selectedTools;
    }

    for (const name in res) {
      const filtered = tools.filter((t) => t.name === name);
      if (!filtered.length) {
        this.logger.warn(
          `Cannot find LLM inferred tool name=${name} avail tools=${tools.map((t) => t.name).join(', ')}`,
        );
        continue;
      }
      const schema = filtered.at(0);
      const tool: SelectedTool = {
        name,
        values: res[name],
        schema: schema,
      };

      selectedTools.push(tool);
    }
    return selectedTools;
  }

  emitChatProgress(ev: DialogueChatProgressEvent) {
    this.emitter.emit('dialogue.chat.progress', ev);
  }

  convertMarkdownLinksToHtml(text: string) {
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return text.replace(markdownLinkRegex, (match, p1, p2) => {
      return `${p2}`;
    });
  }

  // splitSentenceOnDelimiter(
  //   sentence: string,
  //   delimiters: string[],
  //   minSplittingSentenceLen: number,
  // ) {
  //   // find first delimiter match
  //   for (const d of delimiters) {
  //     const index = sentence.indexOf(d, minSplittingSentenceLen);
  //     if (index > -1) {
  //       sentence = sentence.substring(0, index + 1);
  //       break;
  //     }
  //   }

  //   return sentence;
  // }

  sendMessage(
    message: DialogueMessageDto,
    messageId: string,
    chunkId: string,
    text: string,
  ) {
    // ensure links are sent as text
    text = this.convertMarkdownLinksToHtml(text);

    const responseMessage: DialogueTextToSpeechDto = {
      ...message,
      actor: 'agent',
      text,
      language: message.language,
      ts: new Date(),
      clientId: message.clientId,
      chunkId,
      messageId,
      appId: message.appId,
      emotion: message.emotion,
    };
    this.emitter.emit('dialogue.chat.message', responseMessage);
  }
}

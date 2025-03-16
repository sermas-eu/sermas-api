import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionService } from 'apps/session/src/session.service';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMBaseArgs } from 'libs/llm/llm.provider.dto';
import { extractProviderName } from 'libs/llm/util';
import { MonitorService } from 'libs/monitor/monitor.service';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { AvatarChatRequest } from './avatar/dialogue.chat.avatar.dto';
import { DialogueChatAvatarService } from './avatar/dialogue.chat.avatar.service';
import { packAvatarObject } from './avatar/utils';
import { DialogueChatProgressEvent } from './dialogue.chat.dto';
import { DialogueVectorStoreService } from './document/dialogue.vectorstore.service';
import { DialogueIntentService } from './intent/dialogue.intent.service';
import { DialogueMemoryService } from './memory/dialogue.memory.service';
import { DialogueTaskDto } from './tasks/store/dialogue.tasks.store.dto';

import { convertTaskToPrompt } from './tasks/util';

@Injectable()
export class DialogueChatService {
  private readonly logger = new Logger(DialogueChatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emitter: EventEmitter2,
    private readonly session: SessionService,
    private readonly avatarChat: DialogueChatAvatarService,
    private readonly memory: DialogueMemoryService,
    private readonly vectorStore: DialogueVectorStoreService,
    private readonly intent: DialogueIntentService,
    private readonly monitor: MonitorService,
  ) {}

  async inference(
    message: DialogueMessageDto,
    llmArgs?: { chatArgs: LLMBaseArgs; toolsArgs: LLMBaseArgs },
  ) {
    const { appId, sessionId } = message;

    const settings = await this.session.getSettings(message);

    if (!llmArgs) {
      const llm = await this.session.getLLM(sessionId);
      llmArgs = {
        chatArgs: llm?.chat ? extractProviderName(llm?.chat) : undefined,
        toolsArgs: llm?.tools ? extractProviderName(llm?.tools) : undefined,
      };
    }

    let tasks: DialogueTaskDto[] = [];
    let currentTask: DialogueTaskDto;

    const intent = await this.intent.match(message);

    // skip invalid input
    if (intent.skipResponse) {
      return;
    }
    // handle task intents
    if (intent.task) {
      // skip chat response
      if (intent.task.skipResponse) return;

      tasks = intent.task.availableTasks;
      currentTask = intent.task.currentTask;
    }

    const avatar = await this.session.getAvatar(message, message.avatar);

    const perf = this.monitor.performance({
      ...message,
      label: 'chat.user',
    });

    // search rag context
    const knowledge = await this.vectorStore.search(appId, message.text);
    // get history
    const summary = await this.memory.getSummary(sessionId);

    const req: AvatarChatRequest = {
      ...(llmArgs || {}),
      sessionContext: createSessionContext(message),

      system: {
        app: settings?.prompt?.text,
        language: message.language || settings?.language,
        avatar: packAvatarObject(avatar),
        history: summary,
        message: message.text,
        emotion: message.emotion || 'neutral',
        tools: intent.tools?.tools,
      },

      chat: {
        knowledge,
        tasks: convertTaskToPrompt(tasks),
        // track current task progress
        task:
          currentTask && (currentTask.hint || currentTask.description)
            ? `${currentTask.name}: ${currentTask.hint || currentTask.description}`
            : undefined,
        field:
          intent.task?.currentField && intent.task?.currentField?.hint
            ? `${intent.task?.currentField.label || intent.task?.currentField.name}: ${intent.task?.currentField.hint}`
            : undefined,
      },
    };

    const res = await this.avatarChat.send(req);

    const { skipResponse } = await this.intent.handleTools({
      appId,
      sessionId,
      text: message.text,
      settings,

      selectedTools: res.tools,
      tools: intent.tools?.tools,
      repositories: intent.tools?.repositories,

      currentField: intent.task?.currentField,
      currentTask,
      isToolExclusive: intent.tools?.isToolExclusive,
      matchOrRemoveTask: intent.tools?.matchOrRemoveTask,
      hasCatchAll: intent.tools?.hasCatchAll,
    });

    if (!res || !res.stream) {
      perf();
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
    }

    res.stream
      .on('data', (chunk: Buffer | string) => {
        perf();

        const text = chunk.toString();

        (text || '')
          .split('\n')
          .map((text) => this.logger.debug(`RESPONSE | ${text}`));

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
      });
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

  splitSentenceOnDelimiter(
    sentence: string,
    delimiters: string[],
    minSplittingSentenceLen: number,
  ) {
    // find first delimiter match
    for (const d of delimiters) {
      const index = sentence.indexOf(d, minSplittingSentenceLen);
      if (index > -1) {
        sentence = sentence.substring(0, index + 1);
        break;
      }
    }

    return sentence;
  }

  sendMessage(
    message: DialogueMessageDto,
    messageId: string,
    chunkId: string,
    text: string,
  ) {
    // ensure links are sent as text
    text = this.convertMarkdownLinksToHtml(text);

    if (this.config.get('LLM_PRINT_RESPONSE') === '1') {
      text.split('\n').forEach((line) => `LLM | ${line}`);
    }

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

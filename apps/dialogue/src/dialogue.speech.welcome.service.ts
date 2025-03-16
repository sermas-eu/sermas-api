import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DialogueEmotionService } from './dialogue.emotion.service';

import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { createSessionContext } from 'apps/session/src/session.context';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { ButtonsUIContentDto } from 'apps/ui/src/ui.content.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { uuidv4 } from 'libs/util';
import { packAvatarObject } from './avatar/utils';
import { DialogueSpeechService } from './dialogue.speech.service';
import {
  welcomeMessagePrompt,
  welcomeMessageSystemPrompt,
} from './dialogue.speech.welcome.prompt';
import { DialogueTasksService } from './tasks/dialogue.tasks.service';
import { DialogueToolsService } from './tools/dialogue.tools.service';
import { ToolTriggerEventDto } from './tools/trigger/dialogue.tools.trigger.dto';

@Injectable()
export class DialogueWelcomeService {
  private readonly logger = new Logger(DialogueWelcomeService.name);

  constructor(
    private readonly speech: DialogueSpeechService,
    private readonly emotion: DialogueEmotionService,
    private readonly app: PlatformAppService,
    private readonly session: SessionService,
    private readonly llmProvider: LLMProviderService,
    private readonly tools: DialogueToolsService,
    private readonly tasks: DialogueTasksService,
    private readonly monitor: MonitorService,
    private readonly broker: MqttService,
  ) {}

  async handleWelcomeText(ev: SessionChangedDto) {
    if (ev.operation !== 'created') return;

    this.logger.verbose(
      `Sending welcome message appId=${ev.appId} sessionId=${ev.record.sessionId}`,
    );

    const app = await this.app.readApp(ev.appId, false);

    if (!app) {
      this.logger.error('No app');
      return;
    }

    const settings = await this.session.getSettings(ev);

    if (settings?.skipWelcomeMessage === true) return;

    const avatar = await this.session.getAvatar(ev);
    const tasks = await this.tasks.list(ev.appId);
    const repositories = await this.tools.loadFromSession(ev);
    const tools = (repositories || []).map((r) => r.tools || []).flat();
    const emotion =
      (await this.emotion.getUserEmotion(ev.record.sessionId)) || undefined;

    const toolsList = [
      ...(tools || []).map((t) => ({
        label: t.description,
        value: `tool/${t.name}`,
        rephrase: true,
      })),
      ...(tasks || [])
        .filter((t) => t.options?.list !== false)
        .map((t) => ({
          label: t.label || t.description,
          value: `task/${t.taskId}`,
          rephrase: t.label === undefined,
        })),
    ];

    const perf = this.monitor.performance({
      ...ev,
      label: 'welcome',
    });

    const llm = await this.session.getLLM(ev.sessionId);

    type WelcomeMessageChatResponse = {
      message: string;
      labels: string[];
    };

    const response = await this.llmProvider.chat<WelcomeMessageChatResponse>({
      ...this.llmProvider.extractProviderName(llm?.tools),
      system: welcomeMessageSystemPrompt({
        app: settings.prompt?.text,
        language: settings.language,
        avatar: packAvatarObject(avatar),
        emotion,
      }),
      user: welcomeMessagePrompt({
        type: 'welcome',
        tools: JSON.stringify(
          toolsList.map((t) => ({ label: t.label, rephrase: t.rephrase })),
        ),
      }),
      stream: false,
      json: true,
      tag: 'chat',
      sessionContext: createSessionContext(ev),
    });

    const messageId = getMessageId();

    if (response.message) {
      const msg: DialogueMessageDto = {
        actor: 'agent',
        requestId: uuidv4(),
        appId: ev.appId,
        language: settings.language,
        sessionId: ev.record.sessionId,
        text: response.message,
        gender: avatar.gender,
        emotion,
        ts: new Date(),
        messageId,
        chunkId: getChunkId(),
      };

      await this.speech.chat(msg);
    }

    if (response.labels) {
      let buttonsList = response.labels;
      if (!buttonsList || !buttonsList.length) {
        this.logger.warn(
          `Failed to generate welcome buttons, invalid response`,
        );
        buttonsList = [];
      }

      const buttons: ButtonsUIContentDto = {
        appId: ev.appId,
        sessionId: ev.record.sessionId,
        metadata: {
          context: 'welcome-tools',
        },
        options: {
          ttsEnabled: false,
          clearScreen: true,
        },
        content: {
          label: '',
          list: toolsList.map((t, i) => ({
            label: buttonsList[i] || t.label,
            value: t.value,
          })),
        },
        contentType: 'buttons',
        chunkId: getChunkId(),
      };

      await this.broker.publish(SermasTopics.ui.content, buttons);
    }

    perf();
  }

  @OnEvent('dialogue.tool.trigger')
  async handleWelcomeTool(ev: ToolTriggerEventDto) {
    const context = this.tools.getSchemaValue(ev.schema, 'context');
    if (context !== 'welcome-tools') return;

    const trigger = this.tools.getSchemaValue(ev.schema, 'value');
    if (!trigger) return;

    const [type, name] = trigger.toString().split('/');

    let matches = false;

    if (type === 'tool') {
      const repository = await this.tools.get(ev.appId);
      if (!repository) return;
      const filtered = (repository.tools || []).filter((t) => t.name === name);
      if (!filtered.length) return;
      this.tools.trigger({
        appId: ev.appId,
        sessionId: ev.sessionId,
        name,
        schema: filtered[0],
        repositoryId: ev.appId,
        source: 'agent',
        values: {},
      });
      matches = true;
    }

    if (type === 'task') {
      const task = await this.tasks.read(name);
      if (!task) return;
      this.tasks.trigger({
        appId: ev.appId,
        sessionId: ev.sessionId,
        values: {
          taskId: name,
        },
        repositoryId: null,
        name: null,
      });
      matches = true;
    }

    if (matches) {
      // this.logger.debug(
      //   `Send clear screen for sessionId=${ev.sessionId} appId=${ev.appId}`,
      // );
      // const clearScreen: ClearScreenDto = {
      //   appId: ev.appId,
      //   sessionId: ev.sessionId,
      //   contentType: 'clear-screen',
      //   content: {} as any,
      // };
      // this.broker.publish(SermasTopics.ui.content, clearScreen);
    }
  }

  listModels() {
    return this.llmProvider.listModels();
  }
}

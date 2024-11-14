import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DialogueEmotionService } from './dialogue.emotion.service';

import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { ButtonsUIContentDto } from 'apps/ui/src/ui.content.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { MqttService } from 'libs/mqtt-handler/mqtt.service';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { getChunkId, getMessageId } from 'libs/sermas/sermas.utils';
import { DialogueSpeechService } from './dialogue.speech.service';
import {
  welcomeMessagePrompt,
  welcomeToolsPrompt,
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
      label: 'chat.welcome-text',
    });

    const llm = await this.session.getLLM(ev.sessionId);

    const welcomeMessageChat = await this.llmProvider.chat({
      // system: createListToolsPrompt(app, toolsList, avatarSettings),
      ...this.llmProvider.extractProviderName(llm?.tools),
      system: welcomeMessagePrompt({
        type: 'welcome',
        settings,
        avatar,
      }),
      stream: true,
      tag: 'chat',
    });

    perf();

    // this.logger.warn(welcomePrompt);

    const emotion =
      (await this.emotion.getUserEmotion(ev.record.sessionId)) || undefined;

    const messageId = getMessageId();

    const onChatData = async (text: string) => {
      const msg: DialogueMessageDto = {
        actor: 'agent',
        appId: ev.appId,
        language: settings.language,
        sessionId: ev.record.sessionId,
        text,
        gender: avatar.gender,
        emotion,
        ts: new Date(),
        messageId,
        chunkId: getChunkId(),
      };

      await this.speech.chat(msg);
    };

    // welcomeChat.stream.on('data', onChatData).on('end', () => {
    //   this.logger.debug(`Welcome response sent`);

    let buttonsPromise = Promise.resolve<ButtonsUIContentDto | null>(null);

    if (toolsList.length) {
      buttonsPromise = this.llmProvider
        .chat<string[]>({
          stream: false,
          json: true,
          system: welcomeToolsPrompt({
            tools: JSON.stringify(
              toolsList.map((t) => ({ label: t.label, rephrase: t.rephrase })),
            ),
            language: settings.language,
          }),
          tag: 'translation',
        })
        .then((buttonsList) => {
          if (!buttonsList || !buttonsList.length) {
            this.logger.warn(
              `Failed to generate welcome buttons, invalid response`,
            );
            return [];
          }

          const buttons: ButtonsUIContentDto = {
            appId: ev.appId,
            sessionId: ev.record.sessionId,
            metadata: {
              context: 'welcome-tools',
            },
            options: {
              ttsEnabled: false,
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
          return buttons;
        })
        .catch((err) => {
          this.logger.error(`Failed to generate welcome buttons: ${err.stack}`);
          return Promise.resolve(null);
        });
    }

    welcomeMessageChat.stream?.on('data', onChatData).on('end', async () => {
      if (toolsList.length) {
        const buttons = await buttonsPromise;
        if (buttons) {
          await this.broker.publish(SermasTopics.ui.content, buttons);
        }
      }
      this.logger.verbose(`Welcome message sent`);
      perf('welcome-text.completed');
    });
    // });
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

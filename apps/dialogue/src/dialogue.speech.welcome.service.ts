import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DialogueEmotionService } from './dialogue.emotion.service.js';

import { PlatformAppService } from '#apps/platform/src/app/platform.app.service';
import { createSessionContext } from '#apps/session/src/session.context';
import { SessionChangedDto } from '#apps/session/src/session.dto';
import { SessionService } from '#apps/session/src/session.service';
import { ButtonsUIContentDto } from '#apps/ui/src/ui.content.dto';
import { UIService } from '#apps/ui/src/ui.service';
import { DialogueMessageDto } from '#libs/language/dialogue.message.dto';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { MonitorService } from '#libs/monitor/monitor.service';
import { MqttService } from '#libs/mqtt-handler/mqtt.service';
import { getChunkId, getMessageId } from '#libs/sermas/sermas.utils';
import { sleep } from '#libs/test';
import { ulid } from 'ulidx';
import { packAvatarObject } from './chat/utils.js';
import { DialogueSpeechService } from './dialogue.speech.service.js';
import {
  welcomeMessagePrompt,
  welcomeMessageSystemPrompt,
} from './dialogue.speech.welcome.prompt.js';
import { DialogueTasksService } from './tasks/dialogue.tasks.service.js';
import { DialogueToolsService } from './tools/dialogue.tools.service.js';
import { ToolTriggerEventDto } from './tools/trigger/dialogue.tools.trigger.dto.js';

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
    private readonly uiService: UIService,
  ) {}

  async handleWelcomeText(ev: SessionChangedDto) {
    if (ev.operation !== 'created') return;

    const app = await this.app.readApp(ev.appId, false);

    if (!app) {
      this.logger.error('No app');
      return;
    }

    const settings = await this.session.getSettings(ev);

    if (settings?.skipWelcomeMessage === true) return;

    this.logger.verbose(
      `Preparing welcome message language=${settings.language || app.settings?.language} appId=${ev.appId} sessionId=${ev.record.sessionId}`,
    );

    const avatar = await this.session.getAvatar(ev);
    const tasks = await this.tasks.list(ev.appId);
    const repositories = await this.tools.loadFromSession(ev);
    const tools = (repositories || []).map((r) => r.tools || []).flat();
    const emotion =
      (await this.emotion.getUserEmotion(ev.record.sessionId)) || undefined;

    // a task enabled as a tool is listed once, as a task
    const isTaskTool = (t: { schema?: { parameter: string }[] }) =>
      (t.schema || []).some((p) => p.parameter === 'taskId');
    const toolsList = [
      ...(tools || [])
        .filter((t) => !isTaskTool(t))
        .map((t) => ({
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
      tag: 'summary',
      sessionContext: createSessionContext(ev),
    });

    if (response?.message) {
      const msg: DialogueMessageDto = {
        actor: 'agent',
        appId: ev.appId,
        language: settings.language,
        sessionId: ev.record.sessionId,
        text: response?.message,
        gender: avatar.gender,
        emotion,
        ts: new Date(),

        messageId: getMessageId(),
        chunkId: getChunkId(),

        requestId: ulid(),
      };

      await this.speech.chat(msg);
    }

    await sleep(100);

    // one button per tool and task; the LLM only rephrases their labels, so a
    // missing or short answer falls back to the original label (D-44)
    if (toolsList.length) {
      const labels = Array.isArray(response?.labels) ? response.labels : [];
      if (labels.length !== toolsList.length) {
        this.logger.debug(
          `Welcome labels: ${labels.length} for ${toolsList.length} buttons, using the original labels for the rest`,
        );
      }
      const buttons: ButtonsUIContentDto = {
        appId: ev.appId,
        sessionId: ev.record.sessionId,
        ts: new Date(),
        metadata: {
          context: 'welcome-tools',
        },
        options: {
          ttsEnabled: false,
          clearScreen: true,
          language: settings.language,
        },
        content: {
          label: '',
          list: toolsList.map((t, i) => ({
            label:
              (typeof labels[i] === 'string' && labels[i].trim()) || t.label,
            value: t.value,
          })),
        },

        contentType: 'buttons',
        messageId: getMessageId(),
        chunkId: getChunkId(),

        requestId: ulid(),
      };

      await this.uiService.showContent(buttons);
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
      // this.uiService.showContent(clearScreen);
    }
  }

  listModels() {
    return this.llmProvider.listModels();
  }
}

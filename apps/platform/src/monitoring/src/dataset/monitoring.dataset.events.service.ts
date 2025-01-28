import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserCharacterizationEventDto,
  UserCharacterizationEventSource,
} from 'apps/detection/src/detection.dto';
import { DialogueTaskProgressDto } from 'apps/dialogue/src/tasks/dialogue.tasks.dto';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { UIInteractionEventDto } from 'apps/ui/src/ui.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { MonitorRecordDto } from 'libs/monitor/monitor.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { MonitoringDatasetService } from './monitoring.dataset.service';
import { LLMResultEvent } from 'libs/llm/llm.provider.dto';

@Injectable()
export class MonitoringDatasetEventsService {
  constructor(private readonly dataset: MonitoringDatasetService) {}

  @OnEvent('monitor')
  async onMonitor(ev: MonitorRecordDto) {
    await this.dataset.save(
      `Performing ${ev.label} took ${Math.floor(ev.value)}ms`,
      {
        ...ev,
        sessionId: ev.sessionId,
        appId: ev.appId,
      },
      'performance',
    );
  }

  @OnEvent('monitor.error')
  async onMonitorError(ev: MonitorRecordDto) {
    await this.dataset.save(
      `An error occurred on app=${ev.appId} during session=${ev.sessionId} with label=${ev.label}`,
      {
        ...ev,
        sessionId: ev.sessionId,
        appId: ev.appId,
      },
      'error',
    );
  }

  @OnEvent('task.progress')
  async onTask(ev: DialogueTaskProgressDto) {
    await this.dataset.save(
      `Task ${ev.task.name} ${ev.record.status}`,
      {
        ...ev,
        sessionId: ev.record.sessionId,
        appId: ev.record.appId,
      },
      'task',
    );
  }

  @OnEvent('session.changed')
  async onSession(ev: SessionChangedDto) {
    let status = ev.operation.toString();
    if (ev.record.closedAt) {
      status = 'closed';
    }

    await this.dataset.save(
      `Session ${status}`,
      { ...ev, sessionId: ev.record.sessionId, appId: ev.record.appId },
      'session',
    );
  }

  @OnEvent('dialogue.chat.message.user')
  async onChat(event: DialogueMessageDto) {
    await this.dataset.save(`User chat message`, event, 'chat');
  }

  @OnEvent('detection.user.characterization')
  async onUserCharaceterization(
    @Payload() event: UserCharacterizationEventDto,
  ) {
    if (event.source !== UserCharacterizationEventSource.emotion_tracker)
      return;

    let emotion = '';
    if (
      event.detections &&
      event.detections.length &&
      event.detections[0].emotion?.value
    ) {
      emotion = event.detections[0].emotion.value;
    }

    await this.dataset.save(
      `Emotion ${emotion} detected`,
      event,
      'characterization',
    );
  }

  @OnEvent('dialogue.speech.audio')
  async onSpeechAudio(payload: DialogueSpeechToTextDto) {
    const data = { ...payload, buffer: undefined };
    await this.dataset.save(`Agent message speech to text`, data, 'stt');
    await this.dataset.saveAudio(payload);
  }

  @OnEvent('dialogue.speech.tts')
  async onTTS(payload: DialogueTextToSpeechDto & { buffer: Buffer }) {
    await this.dataset.saveAudio(payload);
  }

  @OnEvent('llm.result')
  async onLLMResult(payload: LLMResultEvent) {
    await this.dataset.save('LLM response', payload, 'chat');
  }

  @Subscribe({
    topic: SermasTopics.ui.interaction,
  })
  async onUiInteraction(@Payload() payload: UIInteractionEventDto) {
    await this.dataset.save(
      `User UI interaction with ${payload.interaction.element}`,
      payload,
      'interaction',
    );
  }

  @Subscribe({
    topic: SermasTopics.dialogue.messages,
  })
  async onAgentDialogueMessage(@Payload() payload: DialogueMessageDto) {
    await this.dataset.save(`Agent chat message`, payload, 'chat');
  }
}

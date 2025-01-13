import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { UserCharacterizationEventDto } from './detection.dto';
import { DetectionService } from './detection.service';
import { VideoFrameEvent } from './detection.streamer.dto';
import { DeepFaceDetectionEvent } from './providers/deepface/deepface.dto';

@Injectable()
export class DetectionEventsService {
  private readonly logger = new Logger(DetectionEventsService.name);
  constructor(private readonly detection: DetectionService) {}

  @OnEvent('dialogue.chat.message.user', { async: true })
  analyseText(payload: DialogueMessageDto) {
    this.detection.analyseText(payload);
  }

  @OnEvent('dialogue.chat.message.user', { async: true })
  detectActivationWord(payload: DialogueMessageDto) {
    this.detection.detectWakeWord(payload);
  }

  @OnEvent('detection.streamer.frame')
  verifyFaces(frame: VideoFrameEvent) {
    this.detection.verifyFaces(frame);
  }

  @OnEvent('detection.face.detected')
  matchFaces(payload: DeepFaceDetectionEvent) {
    this.detection.matchFaces(payload);
  }

  @OnEvent('detection.streamer.frame', { async: true })
  detectFaces(payload: VideoFrameEvent) {
    this.detection.detectFaces(payload);
  }

  @OnEvent('dialogue.speech.audio')
  async classifySpeech(payload: DialogueSpeechToTextDto) {
    this.detection.classifySpeech(payload);
  }

  @OnEvent('detection.user.characterization')
  async trackEmotion(payload: UserCharacterizationEventDto) {
    this.detection.trackEmotion(payload);
  }

  @Subscribe({
    topic: SermasTopics.detection.userCharacterization,
  })
  onCharacterizationMessage(@Payload() payload: UserCharacterizationEventDto) {
    this.detection.trackEmotion(payload);
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { MonitorService } from 'libs/monitor/monitor.service';
import { Emotion, EmotionInferenceValue } from 'libs/sermas/sermas.dto';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { DetectionAsyncApiService } from './detection.async.service';
import {
  InteractionType,
  ObjectDetectionDto,
  ObjectDetectionRequest,
  ObjectDetectionType,
  UserCharacterizationDto,
  UserCharacterizationEventDto,
  UserCharacterizationEventSource,
  UserDetectionDto,
  UserDetectionEventDto,
  UserInteractionIntentionDto,
} from './detection.dto';
import { VideoFrameEvent } from './detection.streamer.dto';
import { DeepFaceDetectionEvent } from './providers/deepface/deepface.dto';
import { DeepfaceService } from './providers/deepface/deepface.service';
import { EmotionTrackerService } from './providers/emotion-tracker/emotion-tracker.service';
import { ChatGPTObjectDetectionService } from './providers/object-detection/object-detection.chatgpt.service';
import { ChatGPTSentimentAnalysisService } from './providers/sentiment-analysis/sentiment-analysis.chatgpt.service';
import { SpeechBrainService } from './providers/speechbrain/speechbrain.service';
import { WakeWordService } from './providers/wake-word/wake-word.service';

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly deepface: DeepfaceService,
    // private readonly faceMatch: FaceMatchService,
    private readonly speechbrain: SpeechBrainService,
    private readonly wakeWord: WakeWordService,
    private readonly sentimentAnalysis: ChatGPTSentimentAnalysisService,
    private readonly emotionTracking: EmotionTrackerService,
    private readonly emitter: EventEmitter2,
    private readonly asyncApi: DetectionAsyncApiService,
    private readonly objectDetection: ChatGPTObjectDetectionService,

    private readonly monitor: MonitorService,
  ) {}

  async detectObject(
    request: ObjectDetectionRequest,
  ): Promise<[ObjectDetectionDto] | null> {
    let res = null;
    if (request.detectionType == ('CARRIED_OBJECT' as ObjectDetectionType)) {
      res = await this.objectDetection.detectObjectCarriedByPerson(
        Buffer.from(request.image),
        request.filter,
      );
    }
    return res;
  }

  async renderOverlay(detectionEvent: DeepFaceDetectionEvent) {
    const outputFrame = await this.deepface.renderBoundingBoxes(detectionEvent);
    // outputFrame = await this.faceMatch.renderOverlay({
    //   ...detectionEvent,
    //   frame: outputFrame,
    // });
    return outputFrame;
  }

  async analiseTextSentiment(
    text: string,
  ): Promise<EmotionInferenceValue | null> {
    const res = await this.sentimentAnalysis.analyse(text);
    return res ? res.emotion : null;
  }

  async publishInteractionIntention(
    payload: UserInteractionIntentionDto,
  ): Promise<void> {
    if (!payload.appId) throw new BadRequestException(`Missing appId`);
    payload.ts = new Date();
    this.logger.log(
      `Publishing interaction intent event ${JSON.stringify(payload)}`,
    );
    this.asyncApi.interactionIntention(payload);
  }

  async detectWakeWord(payload: DialogueMessageDto) {
    // todo
    if (payload.actor === 'agent') return;
    if (!payload.text || !payload.text.length) return;

    const matchWakeWord = await this.wakeWord.match(payload.text);
    if (matchWakeWord === null) return;

    this.logger.log(`Wake word matched with word=${matchWakeWord}`);

    const { appId, clientId, sessionId } = payload;

    const ev: UserInteractionIntentionDto = {
      appId,
      clientId,
      moduleId: 'avatar',
      sessionId,
      source: 'wake_word',
      probability: 1,
      userId: null,
      interactionType: InteractionType.start,
      ts: new Date(),
    };
    this.publishInteractionIntention(ev);
  }

  async analyseText(payload: DialogueMessageDto) {
    if (payload.actor === 'agent') return;

    const perf = this.monitor.performance({
      ...payload,
      label: 'sentiment_analysis.text',
    });

    const result = await this.analiseTextSentiment(payload.text);
    perf();

    if (result === null) return;

    const { appId, clientId, sessionId } = payload;

    const userCharacterizationEventDto: UserCharacterizationEventDto = {
      appId,
      sessionId,
      clientId,
      ts: new Date(),
      detections: [
        {
          emotion: result,
        },
      ],
      source: UserCharacterizationEventSource.sentiment_analysis,
    };

    this.emitter.emit(
      'detection.user.characterization',
      userCharacterizationEventDto,
    );
    this.asyncApi.userCharacterization(userCharacterizationEventDto);
  }

  async detectFaces(payload: VideoFrameEvent) {
    const { appId, cameraId, frame } = payload;

    const detections = await this.deepface.detect(frame);
    if (detections === null) return;

    const detectionEvent: DeepFaceDetectionEvent = {
      appId,
      cameraId,
      frame,
      detections: detections || [],
    };

    if (!detectionEvent.detections.length) return;

    this.emitter.emit('detection.face.detected', detectionEvent);

    const userDetectionEvent: UserDetectionEventDto = {
      appId,
      cameraId,
      source: 'deepface',
      detections: detections.map(
        (deepFaceDetection) =>
          ({
            face: deepFaceDetection.region,
          }) as UserDetectionDto,
      ),
      ts: new Date(),
    };

    // send person detection event
    this.asyncApi.userDetected(userDetectionEvent);

    if (!detections) return;
    detections.forEach((detection) => {
      const event: UserCharacterizationDto = {
        age: {
          probability: 1, // TODO
          value: detection.age || null,
        },
        emotion: {
          probability: 1, // TODO
          value: detection.dominant_emotion
            ? (detection.dominant_emotion as Emotion)
            : null,
        },
      };

      const userCharacterizationEventDto: UserCharacterizationEventDto = {
        appId,
        clientId: null,
        ts: new Date(),
        detections: [event],
        source: UserCharacterizationEventSource.deepface,
      };

      this.emitter.emit(
        'detection.user.characterization',
        userCharacterizationEventDto,
      );
      this.asyncApi.userCharacterization(userCharacterizationEventDto);
    });
  }

  async trackEmotion(payload: UserCharacterizationEventDto) {
    this.emotionTracking.update(payload);
  }

  async classifySpeech(payload: DialogueSpeechToTextDto) {
    const { buffer, appId, clientId, sessionId } = payload;

    //TODO: diarization, eg. detect and eventually extract multiple speakers streams

    const perf = this.monitor.performance({
      ...payload,
      label: 'sentiment_analysis.audio',
    });

    const sc = await this.speechbrain.classify(buffer);
    perf();
    if (sc === null) return;

    const detection: UserCharacterizationDto = {
      emotion: sc.emotion,
      user: sc.speakerId ? [sc.speakerId] : [],
      embedding: sc.embeddings,
    };

    const userCharacterizationEventDto: UserCharacterizationEventDto = {
      appId,
      clientId,
      ts: new Date(),
      detections: [detection],
      source: UserCharacterizationEventSource.speechbrain,
      sessionId,
    };

    this.emitter.emit(
      'detection.user.characterization',
      userCharacterizationEventDto,
    );
    this.asyncApi.userCharacterization(userCharacterizationEventDto);
  }

  async verifyFaces(frame: VideoFrameEvent) {
    this.logger.log(`TODO: upgrade to handle each detection`);
    // this.faceMatch.verify(frame);
  }

  async matchFaces(ev: DeepFaceDetectionEvent) {
    // const event = await this.faceMatch.matchFaces(ev);
    // this.emitter.emit('detection.face.match', event);
    // this.mqtt.publish(MQTTtopics.faceMatch, event);
  }
}

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'apps/api/src/app.module';
import {
  InteractionType,
  UserInteractionIntentionDto,
} from 'apps/detection/src/detection.dto';
import { DetectionService } from 'apps/detection/src/detection.service';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { uuidv4 } from 'libs/util';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { sleep } from 'libs/test';
import { waitEvents } from 'libs/util';
import { SessionAgentService } from './agent/session.agent.service';
import { AgentStatus } from './session.dto';
import { SessionService } from './session.service';

jest.setTimeout(10 * 1000);

describe('SessionAgentService', () => {
  let moduleRef: TestingModule;

  let sessionService: SessionService;
  let detectionService: DetectionService;
  let platformAppService: PlatformAppService;
  let sessionAgentService: SessionAgentService;

  let emitter: EventEmitter2;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [],
      providers: [],
    }).compile();

    moduleRef.useLogger(new Logger());

    sessionService = moduleRef.get(SessionService);
    platformAppService = moduleRef.get(PlatformAppService);
    sessionAgentService = moduleRef.get(SessionAgentService);
    detectionService = moduleRef.get(DetectionService);
    emitter = moduleRef.get<EventEmitter2>(EventEmitter2);

    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('handle events', () => {
    it('should handle interaction intent', async () => {
      const appId = `TEST-${uuidv4()}`;
      const moduleId = 'avatar';

      await platformAppService.createApp({
        skipClients: true,
        data: {
          ownerId: 'user1',
          appId,
          modules: [
            {
              moduleId,
              supports: ['dialogue'],
            },
          ],
        },
      });

      await sleep(500);

      await sessionAgentService.onAgentHeartBeat({
        appId,
        moduleId,
        status: AgentStatus.ready,
      });

      const evTopic = `mqtt.pub.${SermasTopics.session.sessionChanged}`;
      const p = waitEvents(emitter, [evTopic], 3000);

      const ev: UserInteractionIntentionDto = {
        moduleId: 'avatar',
        appId,
        probability: 1,
        source: 'button',
        sessionId: 'foo',
        interactionType: InteractionType.start,
      };
      await detectionService.publishInteractionIntention(ev);

      await sleep(2000);
      const res = await p;

      expect(res[evTopic] && res[evTopic].length).not.toBeFalsy();

      await sleep(500);
    });
  });
});

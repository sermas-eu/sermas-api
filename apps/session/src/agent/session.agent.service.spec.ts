import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'apps/api/src/app.module';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { uuidv4 } from 'libs/dataset/src';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { waitEvents } from 'libs/util';
import { AgentStatus } from '../session.dto';
import { SessionAgentService } from './session.agent.service';

jest.setTimeout(10 * 1000);

describe('SessionAgentService', () => {
  let sessionAgentService: SessionAgentService;
  let platformAppService: PlatformAppService;
  let emitter: EventEmitter2;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [],
      providers: [],
    }).compile();

    sessionAgentService =
      moduleRef.get<SessionAgentService>(SessionAgentService);
    platformAppService = moduleRef.get<PlatformAppService>(PlatformAppService);
    emitter = moduleRef.get<EventEmitter2>(EventEmitter2);

    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('handle modules hearthbeat', () => {
    it('should map modules status', async () => {
      const moduleId = () => `module-${uuidv4()}`;

      const app = await platformAppService.createApp({
        skipClients: true,
        data: {
          ownerId: 'user1',
          name: 'TestApp',
          modules: [
            {
              moduleId: moduleId(),
              supports: ['dialogue'],
            },
            {
              moduleId: moduleId(),
              supports: ['dialogue'],
            },
          ],
        },
      });

      let events = await waitEvents(
        emitter,
        [`mqtt.pub.${SermasTopics.session.agentChanged}`],
        1500,
      );
      expect(Object.values(events)[0].length).not.toBe(0);

      // wait for agent change event
      const eventsPromise = waitEvents(
        emitter,
        [`mqtt.pub.${SermasTopics.session.agentChanged}`],
        1500,
      );

      const agents = await sessionAgentService.onAgentHeartBeat({
        appId: app.appId,
        moduleId: moduleId(),
        status: AgentStatus.ready,
        clientId: 'client1',
        ts: new Date(),
      });

      expect(agents.length).toBe(1);

      events = await eventsPromise;
      expect(Object.values(events)[0].length).not.toBe(0);
    });
  });
});

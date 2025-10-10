import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from 'apps/session/src/session.service';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { DialogueAsyncApiService } from '../dialogue.async.service';
import { DialogueVectorStoreService } from '../document/dialogue.vectorstore.service';
import { DialogueIntentService } from '../intent/dialogue.intent.service';
import { DialogueMemoryService } from '../memory/dialogue.memory.service';
import { DialogueChatService } from './dialogue.chat.service';

jest.setTimeout(10 * 1000);

describe('DialogueChatService', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [],
      providers: [],
    }).compile();

    moduleRef.useLogger(new Logger());
    await moduleRef.init();
  });
  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  describe('handle chat', () => {
    it('should trim prefixes', async () => {
      const dialogueChatService = new DialogueChatService(
        jest.mocked(ConfigService) as any,
        jest.mocked(EventEmitter2) as any,
        jest.mocked(SessionService) as any,
        jest.mocked(LLMProviderService) as any,
        jest.mocked(DialogueIntentService) as any,
        jest.mocked(DialogueMemoryService) as any,
        jest.mocked(DialogueVectorStoreService) as any,
        jest.mocked(MonitorService) as any,
        jest.mocked(DialogueAsyncApiService) as any,
      );

      const key = 'my message';
      const texts = [
        `<chat response>${key}`,
        `<chat response>${key}</chat response>`,
        `<chatresponse>${key}</chatresponse>`,
        `<chat-response>${key}`,
        `${key}</chat_response>`,
        `<intents><chatresponse>${key}</chatresponse>`,
        `##INTENTS\n\n###FILTER\n${key}`,
        `##INTENTS:\n\n##FILTER:\n${key}`,
        `#INTENTS\n\n\n##FILTER:\n${key}`,
        `##FILTER:<intents><chatresponse>${key}</chatresponse>`,
      ];

      texts.forEach((text) => {
        const res = dialogueChatService.cleanTextWrappers(text);
        if (res !== key) {
          console.warn(`'${text}' => ${res}`);
        }
        expect(res).toBe(key);
      });
    });
  });
});

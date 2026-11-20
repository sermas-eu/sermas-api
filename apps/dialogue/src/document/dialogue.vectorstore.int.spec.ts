// Live: needs Chroma and an OpenAI-compatible embeddings endpoint, configured
// through ENV_PATH (sermas-dev: config/api/.env). Run with `npm run test:int`.
import { CacheModule } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { SermasConfigModule } from '#apps/api/src/sermas.config.module';
import { LLMModule } from '#libs/llm/llm.module';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { MonitorModule } from '#libs/monitor/monitor.module';
import { MonitorService } from '#libs/monitor/monitor.service';
import { ConfigService } from '@nestjs/config';
import { uuidv4 } from '#libs/util';
import { ChromaClient } from 'chromadb';
import { createHash } from 'crypto';
import { DialogueDocumentDto } from './dialogue.document.dto.js';
import {
  DialogueVectorStoreService,
  parseChromaUrl,
} from './dialogue.vectorstore.service.js';

describe('DialogueVectorStoreService (live)', () => {
  let moduleRef: TestingModule;
  let store: DialogueVectorStoreService;
  let chroma: ChromaClient;
  const appId = `test-${uuidv4()}`;
  const name = createHash('sha1').update(appId).digest('hex');

  const doc = (documentId: string, content: string): DialogueDocumentDto => ({
    appId,
    documentId,
    content,
    metadata: { source: 'live-test', options: { parser: 'single-line' } },
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        SermasConfigModule,
        CacheModule.register({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        MonitorModule,
        LLMModule,
      ],
      providers: [DialogueVectorStoreService],
    }).compile();
    moduleRef.useLogger(new Logger());
    await moduleRef.init();
    store = moduleRef.get(DialogueVectorStoreService);
    chroma = new ChromaClient(parseChromaUrl(process.env.CHROMA_URL));
  }, 60_000);

  afterAll(async () => {
    await chroma?.deleteCollection({ name }).catch(() => undefined);
    await moduleRef?.close();
  });

  it('indexes, searches and replaces documents', async () => {
    await store.saveDocuments(appId, [
      doc(
        'museum',
        'The museum opens at nine in the morning.\nTickets cost twelve euros.\nThe cafe is on the second floor.',
      ),
      doc('weather', 'Tomorrow will be sunny with a light breeze.'),
    ]);

    const coll = await chroma.getCollection({ name });
    expect(await coll.count()).toBe(4);
    expect(coll.metadata?.sermas_embeddings).toBe(
      await moduleRef.get(LLMProviderService).embeddingsFingerprint(),
    );
    expect(coll.metadata?.sermas_dimension).toBeGreaterThan(0);

    const found = await store.search(appId, 'How much is a ticket?', 1);
    expect(found).toContain('twelve euros');

    await store.saveDocuments(appId, [
      doc('museum', 'The museum is closed on Mondays.'),
    ]);
    expect(await coll.count()).toBe(2);

    await store.removeDocuments(appId, 'weather');
    expect(await coll.count()).toBe(1);
  }, 120_000);

  it('re-indexes a collection built with another embedding model', async () => {
    const coll = await chroma.getCollection({ name });
    await coll.modify({
      metadata: { ...coll.metadata, sermas_embeddings: 'other/model' },
    });

    const fresh = new DialogueVectorStoreService(
      moduleRef.get(ConfigService),
      moduleRef.get(LLMProviderService),
      moduleRef.get(MonitorService),
      moduleRef.get(EventEmitter2),
    );
    const reindex = new Promise((resolve) =>
      moduleRef.get(EventEmitter2).once('dialogue.document.reindex', resolve),
    );
    await fresh.getCollection(appId);
    await expect(reindex).resolves.toEqual({ appId });

    const rebuilt = await chroma.getCollection({ name });
    expect(await rebuilt.count()).toBe(0);
  }, 60_000);
});

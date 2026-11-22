import { readFile } from 'fs/promises';
import { DialogueDocumentDto } from './dialogue.document.dto.js';
import {
  DialogueVectorStoreService,
  chunkMetadata,
  parseChromaUrl,
} from './dialogue.vectorstore.service.js';

const fakeCollection = (metadata: Record<string, any> = {}) => ({
  metadata,
  delete: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  modify: vi.fn(async ({ metadata: m }) => {
    Object.assign(metadata, m);
  }),
});

const createService = (collection: any, vectorSize = 3) => {
  const llm = {
    embeddings: vi.fn(async (texts: string[]) =>
      texts.map(() => new Array(vectorSize).fill(0.1)),
    ),
    embeddingsFingerprint: vi.fn().mockResolvedValue('openai/test-model'),
  };
  const monitor = { performance: () => () => undefined };
  const config = { get: () => 'http://chroma.local:8000' };
  const emitter = { emit: vi.fn() };
  const service = new DialogueVectorStoreService(
    config as any,
    llm as any,
    monitor as any,
    emitter as any,
  );
  vi.spyOn(service, 'getCollection').mockResolvedValue(collection);
  return { service, llm, emitter };
};

const doc = (documentId: string, content: string): DialogueDocumentDto => ({
  appId: 'app1',
  documentId,
  content,
  metadata: { source: 'test', options: { parser: 'single-line' } },
});

describe('DialogueVectorStoreService (unit)', () => {
  it('parses the Chroma URL', () => {
    expect(parseChromaUrl('http://172.17.0.1:8000')).toEqual({
      host: '172.17.0.1',
      port: 8000,
      ssl: false,
    });
    expect(parseChromaUrl('https://chroma.example.org')).toEqual({
      host: 'chroma.example.org',
      port: 443,
      ssl: true,
    });
  });

  it('keeps only flat metadata values', () => {
    expect(chunkMetadata('app1', doc('d1', 'x'), 2)).toEqual({
      appId: 'app1',
      documentId: 'd1',
      chunk: 2,
      source: 'test',
    });
  });

  it('embeds and replaces each document on its own', async () => {
    const collection = fakeCollection();
    const { service, llm } = createService(collection);

    await service.saveDocuments('app1', [
      doc('d1', 'one\ntwo'),
      doc('d2', 'three'),
    ]);

    expect(llm.embeddings).toHaveBeenNthCalledWith(1, ['one', 'two']);
    expect(llm.embeddings).toHaveBeenNthCalledWith(2, ['three']);
    expect(collection.delete).toHaveBeenCalledWith({
      where: { documentId: 'd1' },
    });
    expect(collection.add.mock.calls.map(([a]) => a.ids)).toEqual([
      ['d1-0', 'd1-1'],
      ['d2-0'],
    ]);
  });

  it('continues past an empty document', async () => {
    const collection = fakeCollection();
    const { service } = createService(collection);
    await service.saveDocuments('app1', [doc('d1', ''), doc('d2', 'text')]);
    expect(collection.add).toHaveBeenCalledTimes(1);
    expect(collection.add.mock.calls[0][0].ids).toEqual(['d2-0']);
  });

  it('records the vector size, then rejects a different one', async () => {
    const collection = fakeCollection();
    await createService(collection, 3).service.saveDocuments('app1', [
      doc('d1', 'a'),
    ]);
    expect(collection.metadata.sermas_dimension).toBe(3);

    const other = createService(collection, 5);
    await other.service.saveDocuments('app1', [doc('d2', 'b')]);
    expect(collection.add).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['parser-sentence.txt', 'sentence', (n: number) => n > 10],
    ['parser-two-line.txt', undefined, (n: number) => n >= 1 && n <= 4],
    ['parser-one-line.txt', 'single-line', (n: number) => n === 4],
    ['parser-two-line.txt', 'double-line', (n: number) => n === 4],
  ] as const)('splits %s by %s', async (file, mode, check) => {
    const { service } = createService(fakeCollection());
    const text = (
      await readFile(`${import.meta.dirname}/tests/${file}`)
    ).toString();
    expect(check(service.extractChunks(text, mode).length)).toBe(true);
  });

  describe('paragraph chunks (the default)', () => {
    const { service } = createService(fakeCollection());
    const chunks = (text: string) => service.extractChunks(text, undefined);
    const sentence = (i: number) =>
      `Sentence number ${i} of a long paragraph talks about something.`;

    it('keeps each paragraph whole', () => {
      const a = `${sentence(1)} ${sentence(2)}`;
      const b = `${sentence(3)} ${sentence(4)}`;
      expect(chunks(`${a}\n\n${b}\n`)).toEqual([a, b]);
    });

    it('joins a short heading to the paragraph after it', () => {
      expect(chunks(`Pilots\n\n${sentence(1)}`)).toEqual([
        `Pilots\n${sentence(1)}`,
      ]);
    });

    it('cuts a long paragraph into whole sentences of at most 800 characters', () => {
      const long = Array.from({ length: 40 }, (_, i) => sentence(i)).join(' ');
      const out = chunks(long);
      expect(out.length).toBeGreaterThan(2);
      expect(out.every((c) => c.length <= 800)).toBe(true);
      expect(out.join(' ').replace(/\s+/g, ' ')).toBe(long);
    });
  });

  // Chroma as seen by the service: each getOrCreate after a delete is a new collection
  const fakeChroma = () => {
    let current: any = null;
    let n = 0;
    let releaseDelete: () => void = () => undefined;
    const chroma = {
      getOrCreateCollection: vi.fn(async ({ metadata }) => {
        if (!current) current = { id: `c${++n}`, metadata: { ...metadata } };
        return current;
      }),
      deleteCollection: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseDelete = () => {
              current = null;
              resolve();
            };
          }),
      ),
    };
    return { chroma, release: () => releaseDelete() };
  };

  const realService = (chroma: any) => {
    const llm = {
      embeddings: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
      embeddingsFingerprint: vi.fn().mockResolvedValue('openai/test-model'),
    };
    const service = new DialogueVectorStoreService(
      { get: () => 'http://chroma.local:8000' } as any,
      llm as any,
      { performance: () => () => undefined } as any,
      { emit: vi.fn() } as any,
    );
    (service as any).client = chroma;
    return service;
  };

  // a new app: the "created" event recreates the collection while its documents
  // are being uploaded; the upload must not get (and cache) the deleted collection
  it('loads a collection only after its deletion has finished', async () => {
    const { chroma, release } = fakeChroma();
    const service = realService(chroma);
    await service.getCollection('app1'); // c1, about to be deleted

    const recreating = service.recreateCollection('app1');
    await vi.waitFor(() => expect(chroma.deleteCollection).toHaveBeenCalled());
    const uploading = service.getCollection('app1'); // during the delete
    // the delete ends only after the upload had its chance to reach Chroma
    await new Promise((r) => setTimeout(r, 20));
    release();
    await recreating;

    const used = await uploading;
    expect(used.id).toBe('c2');
    expect((await service.getCollection('app1')).id).toBe('c2');
  });

  it('reloads a stale collection once when a search fails', async () => {
    const stale = {
      query: vi.fn().mockRejectedValue(new Error('Nothing found on disk')),
    };
    const fresh = {
      query: vi.fn().mockResolvedValue({ documents: [['answer']] }),
    };
    const service = realService({});
    const get = vi
      .spyOn(service, 'getCollection')
      .mockResolvedValueOnce(stale as any)
      .mockResolvedValueOnce(fresh as any);
    await expect(service.search('app1', 'question')).resolves.toBe('answer');
    expect(get).toHaveBeenCalledTimes(2);
  });
});

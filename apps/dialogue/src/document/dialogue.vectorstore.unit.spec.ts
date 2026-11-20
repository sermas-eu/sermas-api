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
    ['parser-sentence.txt', undefined, (n: number) => n > 10],
    ['parser-one-line.txt', 'single-line', (n: number) => n === 4],
    ['parser-two-line.txt', 'double-line', (n: number) => n === 4],
  ] as const)('splits %s by %s', async (file, mode, check) => {
    const { service } = createService(fakeCollection());
    const text = (
      await readFile(`${import.meta.dirname}/tests/${file}`)
    ).toString();
    expect(check(service.extractChunks(text, mode).length)).toBe(true);
  });
});

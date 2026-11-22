import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  DialogueDocumentDto,
  DocumentParseMode,
} from '#apps/dialogue/src/document/dialogue.document.dto';
import {
  ChromaClient,
  Collection,
  EmbeddingFunction,
  Metadata,
} from 'chromadb';

import { PlatformAppChangedDto } from '#apps/platform/src/app/platform.app.dto';
import { createHash } from 'crypto';
import { LLMProviderService } from '#libs/llm/llm.provider.service';
import { MonitorService } from '#libs/monitor/monitor.service';
import {
  parseByBlock,
  parseByParagraph,
  parseBySentence,
} from './text-parsers.js';

const hash = (x: string) => createHash('sha1').update(x).digest('hex');

/** Collection metadata keys recording the embedding space of its vectors. */
const EMBEDDINGS_KEY = 'sermas_embeddings';
const DIMENSION_KEY = 'sermas_dimension';

export const parseChromaUrl = (chromaUrl: string) => {
  const url = new URL(chromaUrl || 'http://localhost:8000');
  const ssl = url.protocol === 'https:';
  return {
    host: url.hostname,
    port: url.port ? +url.port : ssl ? 443 : 80,
    ssl,
  };
};

/** Chroma accepts only flat, primitive metadata values. */
export const chunkMetadata = (
  appId: string,
  document: DialogueDocumentDto,
  chunk: number,
): Metadata => {
  const meta: Metadata = { appId, documentId: document.documentId, chunk };
  for (const [key, value] of Object.entries(document.metadata || {})) {
    if (['string', 'number', 'boolean'].includes(typeof value))
      meta[key] = value as string | number | boolean;
  }
  return meta;
};

@Injectable()
export class DialogueVectorStoreService {
  private readonly logger = new Logger(DialogueVectorStoreService.name);

  private readonly client: ChromaClient;
  private readonly collections: Record<string, Promise<Collection | null>> = {};
  // collections being deleted: a load waits for it, or it would cache the deleted one
  private readonly deleting: Record<string, Promise<void>> = {};

  private readonly embeddingFunction: EmbeddingFunction;

  constructor(
    private readonly config: ConfigService,
    private readonly llmProvider: LLMProviderService,
    private readonly monitor: MonitorService,
    private readonly emitter: EventEmitter2,
  ) {
    this.client = new ChromaClient(
      parseChromaUrl(this.config.get('CHROMA_URL')),
    );
    this.embeddingFunction = {
      generate: (texts: string[]) => this.llmProvider.embeddings(texts),
    };
  }

  @OnEvent('dialogue.document.saved')
  async onDocumentSaved(doc: DialogueDocumentDto | DialogueDocumentDto[]) {
    const docs = doc instanceof Array ? doc : [doc];

    const byApp: Record<string, DialogueDocumentDto[]> = {};
    for (const d of docs) (byApp[d.appId] = byApp[d.appId] || []).push(d);

    await Promise.all(
      Object.entries(byApp).map(([appId, documents]) =>
        this.saveDocuments(appId, documents).catch((e) => {
          this.logger.error(
            `Failed to save docs for appId=${appId}: ${e.message}`,
          );
          this.logger.debug(e);
        }),
      ),
    );
  }

  @OnEvent('dialogue.document.removed')
  async onDocumentRemoved(doc: DialogueDocumentDto) {
    const { appId, documentId } = doc;
    await this.removeDocuments(appId, documentId);
  }

  @OnEvent('platform.app')
  async onAppChange(ev: PlatformAppChangedDto) {
    this.logger.debug(
      `Received app change operation=${ev.operation} appId=${ev.record.appId}`,
    );
    if (ev.operation === 'deleted') {
      await this.deleteCollection(ev.appId);
    }
    if (ev.operation === 'created') {
      await this.recreateCollection(ev.appId);
    }
  }

  private async deleteCollection(appId: string) {
    const name = hash(appId);
    const run = (this.deleting[name] || Promise.resolve()).then(async () => {
      try {
        await this.client.deleteCollection({ name });
        this.logger.log(`Removed collection appId=${appId} name=${name}`);
      } catch (e) {
        this.logger.debug(`No collection removed appId=${appId}: ${e.message}`);
      }
    });
    this.deleting[name] = run;
    delete this.collections[name];
    await run;
    if (this.deleting[name] === run) delete this.deleting[name];
  }

  async recreateCollection(appId: string) {
    await this.deleteCollection(appId);
    await this.getCollection(appId);
  }

  async heartbeat() {
    try {
      await this.client.heartbeat();
    } catch (e) {
      this.logger.error(`ChromaDB heartbeat failed: ${e.stack}`);
    }
  }

  async removeDocuments(appId: string, ids: string | string[]) {
    ids = ids instanceof Array ? ids : [ids];
    this.logger.debug(`Remove appId=${appId} documentId=${ids.join(',')}`);
    const collection = await this.getCollection(appId);
    if (!collection) {
      this.logger.warn('Collection not found');
      return;
    }
    await collection.delete({ where: { documentId: { $in: ids } } });
  }

  extractChunks(raw: string, parserMode?: DocumentParseMode) {
    switch (parserMode) {
      case 'single-line':
        return parseByBlock(raw, '\n');
      case 'double-line':
        return parseByBlock(raw, '\n\n');
      case 'sentence':
        return parseBySentence(raw);
      case 'paragraph':
      default:
        return parseByParagraph(raw);
    }
  }

  /** Replaces the chunks of each document: one embeddings call per document. */
  async saveDocuments(appId: string, documents: DialogueDocumentDto[]) {
    const collection = await this.getCollection(appId);
    if (!collection) {
      this.logger.warn(
        `Import error, no collection for appId=${appId}: ${documents.length} documents skipped`,
      );
      return;
    }

    for (const document of documents) {
      const perf = this.monitor.performance({
        appId,
        label: 'document.save',
        threshold: 10 * 1000,
      });

      const chunks = this.extractChunks(
        document.content || '',
        document.metadata?.options?.parser,
      ).filter((chunk) => chunk.length);

      await collection.delete({ where: { documentId: document.documentId } });

      if (!chunks.length) {
        this.logger.debug(
          `Skip empty document ${document.documentId} appId=${appId}`,
        );
        continue;
      }

      try {
        const embeddings = await this.llmProvider.embeddings(chunks);
        await this.checkDimension(appId, collection, embeddings);
        await collection.add({
          ids: chunks.map((_, i) => `${document.documentId}-${i}`),
          documents: chunks,
          embeddings,
          metadatas: chunks.map((_, i) => chunkMetadata(appId, document, i)),
        });
      } catch (e) {
        this.logger.error(
          `Failed to index documentId=${document.documentId} appId=${appId}: ${e.message}`,
        );
        this.logger.debug(e);
        continue;
      }

      perf();
      this.logger.debug(
        `Imported appId=${appId} docId=${document.documentId} with ${chunks.length} chunks`,
      );
    }
  }

  /** Records the vector size on first use; rejects vectors of another size. */
  private async checkDimension(
    appId: string,
    collection: Collection,
    embeddings: number[][],
  ) {
    const size = embeddings[0]?.length;
    const recorded = collection.metadata?.[DIMENSION_KEY];
    if (recorded === undefined || recorded === null) {
      await collection.modify({
        metadata: { ...collection.metadata, [DIMENSION_KEY]: size },
      });
      return;
    }
    if (recorded !== size)
      throw new Error(
        `Embedding size ${size} does not match collection size ${recorded} for appId=${appId}`,
      );
  }

  async getCollection(appId: string): Promise<Collection | null> {
    if (!appId) return null;
    const name = hash(appId);
    if (!this.collections[name]) {
      const deleted = this.deleting[name] || Promise.resolve();
      this.collections[name] = deleted
        .then(() => this.loadCollection(appId, name))
        .catch((e) => {
          this.logger.error(`Failed to get collection ${appId} (name=${name})`);
          this.logger.warn(e.stack);
          delete this.collections[name];
          return null;
        });
    }
    return this.collections[name];
  }

  /**
   * Opens the app collection. A collection built with another embedding model
   * (or by a version that did not record it) is dropped, and its documents
   * are indexed again from the document store.
   */
  private async loadCollection(appId: string, name: string) {
    const fingerprint = await this.llmProvider.embeddingsFingerprint();
    const create = () =>
      this.client.getOrCreateCollection({
        name,
        embeddingFunction: this.embeddingFunction,
        metadata: { appId, [EMBEDDINGS_KEY]: fingerprint },
      });

    let collection = await create();
    const built = collection.metadata?.[EMBEDDINGS_KEY];
    if (built !== fingerprint) {
      this.logger.warn(
        `Collection for appId=${appId} was built with embeddings=${built || 'unknown'}, now ${fingerprint}: re-indexing`,
      );
      await this.client.deleteCollection({ name });
      collection = await create();
      this.emitter.emit('dialogue.document.reindex', { appId });
    }
    this.logger.debug(`Loaded collection ${appId} (name=${name})`);
    return collection;
  }

  async search(appId: string, qs: string, limit = 4) {
    try {
      return await this.searchOnce(appId, qs, limit);
    } catch (e: any) {
      // a cached collection can be stale (deleted or recreated in Chroma since it
      // was loaded): load it again and retry once
      this.logger.warn(
        `Search failed for appId=${appId}, reloading the collection: ${e.message}`,
      );
      delete this.collections[hash(appId)];
      return await this.searchOnce(appId, qs, limit);
    }
  }

  private async searchOnce(appId: string, qs: string, limit: number) {
    const collection = await this.getCollection(appId);
    if (!collection) return '';

    const perf = this.monitor.performance({
      appId,
      label: 'embeddings.search',
      threshold: 1000,
    });

    const queryEmbeddings = await this.llmProvider.embeddings([qs]);
    const response = await collection.query({
      nResults: limit,
      queryEmbeddings,
    });

    perf();

    // unique chunks, in rank order
    const knowledge = new Set<string>(
      (response.documents?.flat() || []).filter(Boolean),
    );
    return [...knowledge].join('\n');
  }
}

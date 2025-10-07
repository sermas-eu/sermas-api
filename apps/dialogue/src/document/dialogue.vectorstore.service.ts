import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DialogueDocumentDto,
  DocumentParseMode,
} from 'apps/dialogue/src/document/dialogue.document.dto';
import { ChromaClient, Collection, IEmbeddingFunction } from 'chromadb';

import { PlatformAppChangedDto } from 'apps/platform/src/app/platform.app.dto';
import { createHash } from 'crypto';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { MonitorService } from 'libs/monitor/monitor.service';
import { parseByBlock, parseBySentence } from './text-parsers';

const hash = (x: string) => createHash('sha1').update(x).digest('hex');

@Injectable()
export class DialogueVectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(DialogueVectorStoreService.name);

  private readonly chromaUrl: string;

  private readonly client: ChromaClient;
  private readonly collections: Record<string, Collection> = {};

  private embeddingFunction: IEmbeddingFunction;

  constructor(
    private readonly config: ConfigService,
    private readonly llmProvider: LLMProviderService,
    private readonly monitor: MonitorService,
  ) {
    this.chromaUrl = this.config.get('CHROMA_URL');
    this.client = new ChromaClient({ path: this.chromaUrl });

    this.embeddingFunction = {
      generate: (texts: string[]): Promise<number[][]> =>
        this.llmProvider.embeddings(texts),
    };
  }

  @OnEvent('dialogue.document.saved')
  async onDocumentSaved(doc: DialogueDocumentDto | DialogueDocumentDto[]) {
    doc = doc instanceof Array ? doc : [doc];

    const docs: Record<string, DialogueDocumentDto[]> = doc.reduce(
      (obj, doc) => {
        obj[doc.appId] = obj[doc.appId] || [];
        obj[doc.appId].push(doc);
        return obj;
      },
      {},
    );

    await Promise.all(
      Object.entries(docs).map(([appId, documents]) => {
        return this.saveDocuments(appId, documents).catch((e) => {
          this.logger.error(
            `Failed to save docs for appId=${appId}: ${e.message}`,
          );
          this.logger.debug(e);
          return Promise.resolve();
        });
      }),
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

  async onModuleInit() {
    //this.heartbeat()
    // await this.init('mimex')
    // await this.import('mimex', this.data)
  }

  private async deleteCollection(appId: string) {
    const appIdHash = hash(appId);

    try {
      this.logger.debug(`Removing documents for appId=${appId}`);
      const coll = await this.getCollection(appId);
      while (true) {
        const res = await coll.peek({ limit: 100 });
        if (!res || res.error || !res.ids.length) break;
        this.logger.debug(
          `Removing ${res.ids.length} documents for appId=${appId}`,
        );
        coll.delete({ ids: res.ids });
      }
    } catch (e) {
      this.logger.error(
        `Failed to remove records from collection=${appId}: ${e.stack}`,
      );
    }

    try {
      await this.client.deleteCollection({ name: appIdHash });
      this.logger.log(`Removed collection appId=${appId} hash=${appIdHash}`);
    } catch (e) {
      this.logger.warn(
        `Failed to remove collection appId=${appId}: ${e.stack}`,
      );
    }
  }

  async recreateCollection(appId: string) {
    await this.deleteCollection(appId);
    const appIdHash = hash(appId);
    try {
      await this.client.getOrCreateCollection({
        name: appIdHash,
        embeddingFunction: this.embeddingFunction,
      });
      this.logger.log(`Created collection appId=${appId} hash=${appIdHash}`);
    } catch (e) {
      this.logger.error(
        `Failed to create collection appId=${appId}: ${e.stack}`,
      );
      return;
    }

    this.logger.debug(
      `Recreated collection for appId=${appId} (name=${appIdHash})`,
    );

    if (this.collections[appIdHash]) delete this.collections[appIdHash];
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
    await collection.delete({ ids });
  }

  extractChunks(raw: string, parserMode?: DocumentParseMode) {
    switch (parserMode) {
      case 'single-line':
        return parseByBlock(raw, '\n');
      case 'double-line':
        return parseByBlock(raw, '\n\n');
      case 'sentence':
      default:
        return parseBySentence(raw);
    }
  }

  async saveDocuments(appId: string, documents: DialogueDocumentDto[]) {
    const ids: string[] = [];
    const docs: string[] = [];
    const metadata: Record<string, any>[] = [];

    const perf = this.monitor.performance({
      appId,
      label: 'document.save',
      threshold: 10 * 1000,
    });

    for (const document of documents) {
      this.logger.debug(
        `Saving document "${document.content.substring(0, 50).replace('\n', ' ')}..."`,
      );
      const chunks = this.extractChunks(
        document.content,
        document.metadata?.options?.parser,
      );

      let i = 0;
      for (const chunk of chunks) {
        if (!chunk.length) continue;
        ids.push(document.documentId + '-' + i);
        docs.push(chunk);
        metadata.push(document.metadata);
        i++;
      }

      if (!docs.length) {
        this.logger.debug(
          `Skip empty document ${document.documentId} appId=${appId}`,
        );
        return;
      }

      const embds: number[][] = await this.llmProvider.embeddings(docs);
      // this.logger.debug(`embds: ${embds}`);
      const collection = await this.getCollection(appId);
      if (!collection) {
        this.logger.warn(
          `Import error, failed to get collection appId=${appId} docId=${document.documentId} with ${docs.length} chunks`,
        );
        continue;
      }

      try {
        await collection.add({
          ids: ids,
          documents: docs,
          embeddings: embds,
          metadatas: metadata,
        });
      } catch (e) {
        this.logger.error(
          `Failed to add collection for appId=${appId}: ${e.message}`,
        );
        this.logger.debug(e);
      }

      perf();

      this.logger.debug(
        `Imported appId=${appId} docId=${document.documentId} with ${docs.length} chunks`,
      );
    }
  }

  async getCollection(
    appId: string,
    embeddingFunction?: IEmbeddingFunction | null,
  ) {
    if (!appId) return null;
    const name = hash(appId);

    if (!this.collections[name]) {
      try {
        this.collections[name] = await this.client.getOrCreateCollection({
          name,
          // use default embedding function if param is set to null
          embeddingFunction:
            embeddingFunction === null
              ? undefined
              : embeddingFunction || this.embeddingFunction,
        });
        this.logger.debug(`Loaded collection ${appId} (name=${name})`);
      } catch (e) {
        this.logger.error(`Failed to get collection ${appId} (name=${name})`);
        this.logger.warn(e.stack);
        return null;
      }
    }

    return this.collections[name];
  }

  async search(appId: string, qs: string, limit = 4) {
    const collection = await this.getCollection(appId);
    if (!collection) return '';

    const perf = this.monitor.performance({
      appId,
      label: 'embeddings.search',
      threshold: 1000,
    });

    const response = await collection.query({
      nResults: limit,
      queryTexts: [qs],
    });

    perf();

    // Using Set to filter out duplicates
    const knowledgeSet = new Set<string>(response.documents?.flat() || []);

    // Joining unique documents
    const knowledge = Array.from(knowledgeSet).join('\n');
    return knowledge;
  }
}

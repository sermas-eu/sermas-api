import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { UIAssetChangedDto } from 'apps/ui/src/ui.asset.dto';
import {
  minioListFiles,
  minioReadFile,
  minioReadMetadata,
} from 'libs/language/minio';
import { toDTO, uuidv4 } from 'libs/util';

import { Model } from 'mongoose';
import { MinioClient, MinioService } from 'nestjs-minio-client';
import * as path from 'path';
import {
  DialogueDocumentDto,
  RagWebsiteDto,
  RepositoryDocument,
} from './dialogue.document.dto';
import { DialogueDocument } from './dialogue.document.schema';
// import axios from 'axios';
import { PlatformAppChangedDto } from 'apps/platform/src/app/platform.app.dto';
import { CheerioCrawler, Sitemap } from 'crawlee';
import { compile } from 'html-to-text';

const QUEUE_TIMEOUT_SEC = 10 * 1000;
type ImportQueueItem = {
  appId: string;
  prefix: string;
  timer?: NodeJS.Timeout;
};

@Injectable()
export class DialogueDocumentService implements OnModuleInit {
  private readonly logger = new Logger(DialogueDocumentService.name);

  private readonly repository;

  private importQueue: ImportQueueItem[] = [];

  constructor(
    @InjectModel(DialogueDocument.name)
    private readonly documentModel: Model<DialogueDocument>,
    private readonly config: ConfigService,
    private readonly emitter: EventEmitter2,
    private readonly minioService: MinioService,
  ) {
    this.repository = config.get('REPOSITORY_BUCKET');
  }

  async onModuleInit() {
    if (this.config.get('RAG_IMPORT') === '1')
      setTimeout(() => this.loadDatasets(), 2500);
  }

  @OnEvent('asset.changed')
  async onAssetChanged(ev: UIAssetChangedDto) {
    if (ev.record.type !== 'documents') return;

    const filtered = this.importQueue.filter((q) => q.appId === ev.appId);

    let queueItem: ImportQueueItem = {
      appId: ev.appId,
      prefix: `${ev.appId}/${ev.record.type}`,
    };
    if (filtered.length) {
      queueItem = filtered[0];
    } else {
      this.importQueue.push(queueItem);
    }

    if (queueItem.timer) {
      clearTimeout(queueItem.timer);
      queueItem.timer = undefined;
    }

    queueItem.timer = setTimeout(async () => {
      this.logger.log(`Importing dataset for ${queueItem.appId}`);
      await this.loadDatasets(queueItem.prefix);
    }, QUEUE_TIMEOUT_SEC);
  }

  async readFile<T = string>(filepath: string, parseJSON = false) {
    try {
      const minio: MinioClient = this.minioService.client;
      return <T>minioReadFile(minio, this.repository, filepath, parseJSON);
    } catch (e: any) {
      this.logger.error(`Failed to read ${filepath}: ${e.stack}`);
    }
  }

  async loadFileMetadata<T = Record<string, any>>(filepath: string) {
    try {
      return await minioReadMetadata<T>(
        this.minioService.client,
        this.repository,
        filepath,
      );
    } catch (e) {
      this.logger.error(
        `Failed to load metadata for ${filepath}: ${e.message}`,
      );
      this.logger.debug(e.stack);
    }
    return {};
  }

  async listFiles(prefix?: string) {
    const minio: MinioClient = this.minioService.client;

    const callback = async (obj: any) => {
      const [appId, type] = obj.name.split('/');

      const doc: RepositoryDocument = {
        appId,
        type,
        name: obj.name,
      };

      return doc;
    };

    const docs = await minioListFiles(minio, this.repository, callback, prefix);

    return docs;
  }

  async loadFromJSON(document: DialogueDocumentDto, filepath: string) {
    const raw = await this.readFile<DialogueDocumentDto>(filepath, true);
    if (raw.content) {
      document.content = raw.content;
    }
    if (raw.metadata) {
      document.metadata = {
        ...raw.metadata,
        ...document.metadata,
      };
    }
    return document;
  }

  async loadDatasets(prefix?: string) {
    const files = await this.listFiles(prefix);

    const appIds: string[] = [];
    for (const doc of files) {
      appIds.push(doc.appId);
    }

    for (const appId of [...new Set(appIds)]) {
      this.emitter.emit('dialogue.document.import', appId);
    }

    const documents: DialogueDocumentDto[] = [];

    for (const doc of files) {
      if (doc.type !== 'documents') continue;

      this.logger.debug(`Importing appId=${doc.appId} ${doc.name}`);

      const metadata = await this.loadFileMetadata(doc.name);

      const filepath = doc.name;
      const basename = path.basename(filepath);
      const ext = path.extname(filepath);
      const appId = doc.appId;

      const document: DialogueDocumentDto = {
        metadata: {
          source: 'import-datasets',
          filename: doc.name.replace(`${doc.appId}/${doc.type}/`, ''),
          ...metadata,
        },
        content: '',
        appId,
        documentId: basename.replace(ext, ''),
      };

      switch (ext) {
        case '.txt':
          document.content = await this.readFile(filepath);
          break;
        case '.json':
          await this.loadFromJSON(document, filepath);
          break;
        default:
          this.logger.warn(`Unsupported format ${ext} for ${filepath} `);
          break;
      }

      if (!document.appId) {
        this.logger.warn(`Skip ${filepath}: missing appId`);
        continue;
      }
      if (!document.documentId) {
        this.logger.warn(`Skip ${filepath}: missing documentId`);
        continue;
      }
      if (!document.content) {
        this.logger.warn(`Skip ${filepath}: missing content`);
        continue;
      }

      documents.push(document);
    }

    await this.import(documents);
    this.logger.log(`Imported ${documents.length} documents`);
  }

  getById(documentId: string, appId?: string) {
    return this.documentModel.findOne({ documentId: documentId, appId }).exec();
  }

  @OnEvent('platform.app')
  async onAppChange(ev: PlatformAppChangedDto) {
    this.logger.debug(
      `Received app change operation=${ev.operation} appId=${ev.record.appId}`,
    );

    if (ev.operation === 'deleted') {
      await this.removeAll(ev.record.appId);
      return;
    }

    if (ev.record.rag && ev.record.rag.websites) {
      this.logger.debug(`Importing ${ev.record.rag.websites.length} websites`);
      for (const www of ev.record.rag.websites) {
        await this.importWebsite(www);
      }
    }
  }

  async import(documents: DialogueDocumentDto[]) {
    this.logger.debug(`Import ${documents.length} documents`);
    const result = await this.save(documents);
    return result;
  }

  async importWebsite(website: RagWebsiteDto) {
    this.logger.debug(`Import content from ${website.url}`);
    //await this.scrap(website);
  }

  async scrap(website: RagWebsiteDto): Promise<void> {
    // trigger collection recreate
    this.emitter.emit('dialogue.document.import', website.appId);
    // use sitemap.xml
    const { urls } = await Sitemap.load(website.url + '/sitemap.xml');
    this.logger.log(`Found ${urls.length} URLs`);
    await this.scrapUrls(website.appId, urls, website.filterPaths, this);
  }

  async scrapUrls(
    appId: string,
    urls: string[],
    filterPaths: string[],
    context: DialogueDocumentService,
  ): Promise<void> {
    const options = {
      wordwrap: 130,
      baseElements: {
        selectors: ['body'],
      },
      ignoreHref: true,
    };
    const compiledConvert = compile(options);
    const crawler = new CheerioCrawler({
      async requestHandler({ request, response, body, $ }) {
        const toFilter = filterPaths.some((f) => request.url.indexOf(f) > -1);
        if (toFilter) {
          context.logger.debug(`Skipped ${request.url}`);
          return;
        }
        const content = compiledConvert(body.toString());
        await context.handleScrapResult(appId, request.url, content);
      },
      failedRequestHandler({ request }) {
        context.logger.warn(`Request ${request.url} failed`);
      },
    });

    await crawler.addRequests(urls);

    // Run the crawler
    await crawler.run();
  }

  async handleScrapResult(
    appId: string,
    url: string,
    data: string,
  ): Promise<void> {
    const doc: DialogueDocumentDto = {
      metadata: {
        source: 'import-website',
        uri: url,
      },
      content: data,
      appId,
      documentId: url
        .replace(/^https:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\//g, '-'),
    };
    await this.save([doc]);
  }

  async save(documents: DialogueDocumentDto[], failOnError = false) {
    const list: DialogueDocumentDto[] = [];
    for (const document of documents) {
      try {
        if (!document.documentId) {
          throw new BadRequestException(`missing documentId`);
        }

        if (!document.content) {
          throw new BadRequestException(`missing content`);
        }

        if (!document.appId) {
          throw new BadRequestException(`missing appId`);
        }
      } catch (e) {
        if (failOnError) throw e;
        this.logger.error(`A document has been skipped: ${e.message}`);
        continue;
      }

      let record = await this.getById(document.documentId, document.appId);

      if (!record) {
        record = new this.documentModel({
          ...document,
          documentId: uuidv4(),
        });
      }

      this.logger.debug(
        `Saving documentId=${document.documentId} for appId=${document.appId}`,
      );

      record.updated = new Date();
      await record.save();

      const dto = toDTO(record);
      list.push(dto);
    }

    this.emitter.emit('dialogue.document.saved', list);
    return list;
  }

  async remove(appId: string, documentId: string[]) {
    if (!documentId.length) throw new BadRequestException('Missing documentId');
    await this.documentModel.deleteMany({ documentId: documentId, appId });
    documentId.forEach((docId) => {
      this.emitter.emit('dialogue.document.removed', {
        documentId: docId,
        appId,
      });
    });
  }

  async removeAll(appId: string) {
    const documents = await this.documentModel.find({ appId });
    const documentId: string[] = documents.map((d) => d.documentId);
    this.logger.log(`Removing ${documentId.length} documents`);
    await this.documentModel.deleteMany({ appId, documentId: documentId });
    // trigger collection recreate
    this.emitter.emit('dialogue.document.import', appId);
  }
}

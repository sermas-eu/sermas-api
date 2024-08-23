import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RepositoryAssetList,
  RepositoryAssetTypes,
} from 'apps/platform/src/app/platform.app.dto';
import { PlatformAppService } from 'apps/platform/src/app/platform.app.service';
import { BucketItem } from 'minio';
import { MinioService } from 'nestjs-minio-client';
import * as path from 'path';
import { UIAssetChangedDto, UIAssetDto } from './ui.asset.dto';
import { UIAsyncApiService } from './ui.async.service';

const BACKGROUND_EXTENSIONS = ['jpg', 'jpeg', 'png'];
const DOCUMENTS_EXTENSIONS = ['txt'];
const AVATAR_EXTENSIONS = ['glb', 'fbx'];

@Injectable()
export class UIAssetService {
  private readonly logger = new Logger(UIAssetService.name);

  private readonly repository;
  private readonly defaults: Record<RepositoryAssetTypes, string>;
  private readonly allowedExtensions: Record<RepositoryAssetTypes, string[]>;

  constructor(
    private readonly minioService: MinioService,
    private readonly async: UIAsyncApiService,
    private readonly config: ConfigService,
    private readonly app: PlatformAppService,
    private readonly emitter: EventEmitter2,
  ) {
    this.repository = this.config.get('REPOSITORY_BUCKET');
    this.defaults = {
      avatars: this.config.get('DEFAULT_MODEL_PATH'),
      backgrounds: this.config.get('DEFAULT_BACKGROUND_PATH'),
      documents: undefined,
      robots: undefined,
      animations: undefined,
    };
    this.allowedExtensions = {
      avatars: AVATAR_EXTENSIONS,
      backgrounds: BACKGROUND_EXTENSIONS,
      documents: DOCUMENTS_EXTENSIONS,
      robots: undefined,
      animations: AVATAR_EXTENSIONS,
    };
  }

  async onModuleInit() {
    await this.ensureRepository();
  }

  async publish(ev: UIAssetChangedDto) {
    this.emitter.emit(`asset.changed`, ev);
    await this.async.assetChanged(ev);
  }

  async ensureRepository() {
    const exists = await this.minioService.client.bucketExists(this.repository);
    if (!exists) {
      await this.minioService.client.makeBucket(
        this.repository,
        this.config.get('REPOSITORY_BUCKET_REGION'),
      );
      this.logger.log(`Created bucket=${this.repository}`);
    }
  }

  async getAssetMetadata(modelPath?: string) {
    const stream = await this.minioService.client.listObjects(
      this.repository,
      modelPath,
      false,
    );

    const buckets = await new Promise<BucketItem[]>((resolve, reject) => {
      const data: BucketItem[] = [];
      stream.on('data', function (obj) {
        data.push(obj);
      });
      stream.on('end', function () {
        resolve(data);
      });
      stream.on('error', function (err) {
        reject(err);
      });
    });

    const found = buckets.filter((b) => b.name === modelPath);
    return found.length ? found.at(0) : null;
  }

  isValidExtension(filename: string, extensions: string[]) {
    if (!filename) return false;
    const ext = path.extname(filename);
    return !extensions.includes(ext.toLowerCase());
  }

  async getAsset(payload: {
    appId: string;
    type: string;
    assetId: string;
    user?: any;
  }): Promise<StreamableFile> {
    const { appId, type, assetId } = payload;

    // ensure app exists
    const app = await this.app.readApp(appId);

    let modelPath = null;

    if (assetId !== 'default') {
      const repo = app.repository[type] || [];
      const filtered = repo.filter((r) => r.id === assetId);
      if (!filtered.length) {
        throw new NotFoundException(`Asset ${assetId} not found`);
      }
      const asset = filtered[0];
      modelPath = `${appId}/${type}/${asset.path}`;
    } else {
      switch (type) {
        case 'avatars':
          modelPath = this.defaults.avatars;
          break;
        case 'backgrounds':
          modelPath = this.defaults.backgrounds;
          break;
        default:
          modelPath = null;
          break;
      }
    }

    if (!modelPath) throw new NotFoundException(`asset path is empty`);

    try {
      // Download the file from Minio
      this.logger.log(
        `Download asset bucket=${this.repository} path=${modelPath}`,
      );

      // if (response) {
      //   const metadata = await this.getAssetMetadata(modelPath);
      //   this.logger.debug(
      //     `Asset ${metadata.name}: set response cache lastModified=${metadata.lastModified} etag=${metadata.etag}`,
      //   );

      //   // seconds to cache
      //   // 1month
      //   const CACHE_SECONDS = 60 * 60 * 24 * 30 * 1000;
      //   response.setHeader('Cache-Control', `private,max-age=${CACHE_SECONDS}`);
      //   if (metadata.etag) response.setHeader('Etag', metadata.etag);
      //   if (metadata.lastModified)
      //     response.setHeader(
      //       'Last-Modified',
      //       new Date(metadata.lastModified).toUTCString(),
      //     );
      // }

      return new StreamableFile(
        await this.minioService.client.getObject(this.repository, modelPath),
      );
    } catch (error) {
      this.logger.error(
        `failed downloading asset ${modelPath}: ${error.message} key=${
          error.key || ''
        } status=${error.status || ''}`,
      );

      if (
        (error.status && error.status === 404) ||
        error.code === 'NoSuchKey'
      ) {
        throw new NotFoundException(`Asset ${modelPath} not found`);
      }

      throw new InternalServerErrorException(
        `Failed to fetch asset: ${error.message}`,
      );
    }
  }

  async saveAsset(data: UIAssetDto, file: Express.Multer.File) {
    if (!data) throw new BadRequestException(`Missing data`);
    if (!data.appId) throw new BadRequestException(`Missing appId`);
    if (!file || !file.buffer)
      throw new BadRequestException(`Missing request file`);

    if (!data.type || !RepositoryAssetList.includes(data.type))
      throw new BadRequestException(
        `Invalid data type ${data.type} [allowed=${RepositoryAssetList}]`,
      );

    const formats = this.allowedExtensions[data.type] || undefined;
    if (formats && !this.isValidExtension(data.filename, formats)) {
      throw new BadRequestException(
        `Unsupported format for ${data.type} [formats=${formats}]`,
      );
    }

    const filename = data.filename || file.originalname;
    const assetPath = `${data.appId}/${data.type}/${filename}`;
    try {
      await this.minioService.client.putObject(
        this.repository,
        assetPath,
        file.buffer,
        data.metadata || {},
      );

      const ev: UIAssetChangedDto = {
        appId: data.appId,
        operation: 'updated',
        record: data,
        ts: new Date(),
      };
      await this.publish(ev);

      this.logger.debug(`Saved asset path=${assetPath} appId=${data.appId}`);
    } catch (e: any) {
      this.logger.error(`Failed to save ${assetPath}: ${e.stack}`);
      throw new InternalServerErrorException(`Failed to save asset`);
    }
  }
}

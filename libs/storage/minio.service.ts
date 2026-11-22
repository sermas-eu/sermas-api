import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

export type MinioClient = Client;

/** The S3-compatible object store (MinIO, RustFS), configured from MINIO_*. */
@Injectable()
export class MinioService {
  readonly client: MinioClient;

  constructor(config: ConfigService) {
    const minioUrl = config.get<string>('MINIO_URL');
    let url: URL | undefined;
    try {
      url = new URL(minioUrl);
    } catch {
      // a bare host name
    }
    this.client = new Client({
      endPoint: url?.hostname || minioUrl,
      port: url?.port ? +url.port : undefined,
      useSSL: url?.protocol === 'https:',
      accessKey: config.get<string>('MINIO_ACCESSKEY'),
      secretKey: config.get<string>('MINIO_SECRETKEY'),
    });
  }
}

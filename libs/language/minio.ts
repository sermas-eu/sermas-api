import { ASSET_METADATA_PREFIX } from 'apps/ui/src/ui.asset.service';
import { MinioClient } from 'nestjs-minio-client';
import { Readable, Transform } from 'stream';

export const minioListFiles = async <T = any>(
  minio: MinioClient,
  repository: string,
  transformCallback: (obj: any) => T | Promise<T>,
  prefix?: string,
): Promise<T[]> => {
  const stream = await minio.listObjects(repository, prefix, true);

  const list: T[] = [];

  const isPromise = (v) =>
    typeof v === 'object' && typeof v.then === 'function';

  await new Promise<T[]>((resolve, reject) => {
    stream.on('error', (err) => {
      reject(err);
    });
    stream.on('end', () => {
      resolve(list);
    });
    stream.pipe(
      new Transform({
        objectMode: true,
        transform: (obj, encoding, callback) => {
          try {
            const res: T | Promise<T> = transformCallback(obj);

            if (!isPromise(res)) {
              list.push(res as T);
              callback();
              return;
            }

            (res as Promise<T>)
              .then((result: T) => {
                list.push(result as T);
                callback();
              })
              .catch(callback);
          } catch (e) {
            callback(e);
          }
        },
      }),
    );
  });

  return list;
};

export const minioReadMetadata = async <T = any>(
  minio: MinioClient,
  repository: string,
  filepath: string,
  prefix = ASSET_METADATA_PREFIX,
) => {
  const res = await minio.statObject(repository, filepath);

  if (!res.metaData) return {} as T;

  const metadata = Object.keys(res.metaData)
    .filter((key) => key.startsWith(prefix))
    .reduce(
      (o, k) => ({
        ...o,
        [k.replace(prefix, '')]: JSON.parse(res.metaData[k]),
      }),
      {} as Record<string, any>,
    );

  return metadata as T;
};
export const minioReadFile = async <T = string>(
  minio: MinioClient,
  repository: string,
  filepath: string,
  parseJSON = false,
) => {
  // const basename = path.basename(filepath)
  // const basepath = filepath.replace(`/${basename}`, '')

  const stream = await minio.getObject(repository, filepath);
  const content = await readStream(stream);

  let res = content.toString();
  if (parseJSON) res = JSON.parse(res);

  return res as T;
};

export const readStream = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
};

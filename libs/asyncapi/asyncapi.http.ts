import { INestApplication } from '@nestjs/common';
import * as YAML from 'js-yaml';
import { AsyncApiDocument } from './asyncapi.types';

/**
 * Serves the document as `<path>-json` and `<path>-yaml`. `getDocument` runs
 * on every request, so the document can change at runtime.
 */
export const serveAsyncApiDocument = (
  app: INestApplication,
  path: string,
  getDocument: () => AsyncApiDocument | Promise<AsyncApiDocument>,
) => {
  const http = app.getHttpAdapter();
  const base = path.startsWith('/') ? path : `/${path}`;

  http.get(`${base}-json`, async (req, res) => {
    http.setHeader(res, 'Content-Type', 'application/json');
    http.reply(res, JSON.stringify(await getDocument()), 200);
  });

  http.get(`${base}-yaml`, async (req, res) => {
    http.setHeader(res, 'Content-Type', 'text/yaml');
    http.reply(res, YAML.dump(await getDocument()), 200);
  });
};

import { INestApplication } from '@nestjs/common';
import { validatePath } from '@nestjs/swagger/dist/utils/validate-path.util';
import * as YAML from 'js-yaml';
import {
  AsyncApiDocument,
  AsyncApiModule,
  AsyncApiTemplateOptions,
} from 'nestjs-asyncapi';

export interface AsyncApiRenderOptions {
  onRender?: (document: AsyncApiDocument) => Promise<AsyncApiDocument>;
}

export class SermasAsyncApiModule {
  public static async setup(
    path: string,
    app: INestApplication,
    document: AsyncApiDocument,
    templateOptions?: AsyncApiTemplateOptions,
    renderOptions?: AsyncApiRenderOptions,
  ) {
    const httpAdapter = app.getHttpAdapter();
    const finalPath = validatePath(path);

    let html = await AsyncApiModule.composeHtml(document, templateOptions);
    let yamlDocument = YAML.dump(document);
    let jsonDocument = JSON.stringify(document);

    const onRender = renderOptions?.onRender;

    httpAdapter.get(finalPath, async (req, res) => {
      res.type('text/html');
      if (onRender) {
        const doc: AsyncApiDocument = await onRender(document);
        html = await AsyncApiModule.composeHtml(doc, templateOptions);
      }
      res.send(html);
    });

    httpAdapter.get(finalPath + '-json', async (req, res) => {
      res.type('application/json');
      if (onRender) {
        jsonDocument = JSON.stringify(await onRender(document));
      }
      res.send(jsonDocument);
    });

    httpAdapter.get(finalPath + '-yaml', async (req, res) => {
      res.type('text/yaml');
      if (onRender) {
        yamlDocument = YAML.dump(await onRender(document));
      }
      res.send(yamlDocument);
    });
  }
}

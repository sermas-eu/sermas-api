import { LogLevel, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PlatformModuleService } from 'apps/platform/src/mod/mod.service';
import { isNodeEnv } from 'libs/util';
import { ValidationPipeOptions } from 'libs/validation/validation-options';
import { AppModule } from './app.module';

const logger = new Logger('bootstrap');

async function bootstrap() {
  const logLevel: LogLevel[] = process.env.LOG_LEVEL
    ? [process.env.LOG_LEVEL as LogLevel]
    : isNodeEnv('development')
      ? ['debug']
      : ['log', 'error', 'warn'];

  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: logLevel,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(new ValidationPipeOptions()));

  try {
    await app.get(PlatformModuleService).setupApiDocs(app);
  } catch (e: any) {
    logger.error(`Failed to setup openapi: ${e.stack}`);
  }

  // fs.writeFile('./asyncapi.json', JSON.stringify(asyncapiDocument));
  await app.listen(3000, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch((e) => logger.error(e.stack));

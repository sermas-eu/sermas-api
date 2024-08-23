import { NestFactory } from '@nestjs/core';
import { XrModule } from './xr.module';

async function bootstrap() {
  const app = await NestFactory.create(XrModule);
  await app.listen(3000);
}
bootstrap();

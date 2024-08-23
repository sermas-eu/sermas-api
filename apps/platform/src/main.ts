import { NestFactory } from '@nestjs/core';
import { PlatformModule } from './platform.module';

async function bootstrap() {
  const app = await NestFactory.create(PlatformModule);
  await app.listen(3000);
}
bootstrap();

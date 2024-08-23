import { NestFactory } from '@nestjs/core';
import { DetectionModule } from './detection.module';

async function bootstrap() {
  const app = await NestFactory.create(DetectionModule, { cors: true });
  await app.listen(3000);
}
bootstrap();

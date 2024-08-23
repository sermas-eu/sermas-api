import { NestFactory } from '@nestjs/core';
import { DialogueModule } from './dialogue.module';

async function bootstrap() {
  const app = await NestFactory.create(DialogueModule, { cors: true });
  await app.listen(3000);
}
bootstrap();

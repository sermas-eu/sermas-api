import { NestFactory } from '@nestjs/core';
import { EdgeModule } from './edge.module';

async function bootstrap() {
  const app = await NestFactory.create(EdgeModule);
  await app.listen(3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { DataCollectionModule } from './data-collection.module';

async function bootstrap() {
  const app = await NestFactory.create(DataCollectionModule);
  await app.listen(3000);
}
bootstrap();

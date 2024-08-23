import { NestFactory } from '@nestjs/core';
import { RoboticsModule } from './robotics.module';

async function bootstrap() {
  const app = await NestFactory.create(RoboticsModule);
  await app.listen(3000);
}
bootstrap();

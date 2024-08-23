import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'apps/auth/src/auth.module';
import { DialogueDocumentController } from './dialogue.document.controller';
import {
  DialogueDocument,
  DialogueDocumentSchema,
} from './dialogue.document.schema';
import { DialogueDocumentService } from './dialogue.document.service';
import { DialogueVectorStoreService } from './dialogue.vectorstore.service';

@Module({
  imports: [
    AuthModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: DialogueDocument.name, schema: DialogueDocumentSchema },
    ]),
  ],
  controllers: [DialogueDocumentController],
  providers: [DialogueVectorStoreService, DialogueDocumentService],
  exports: [DialogueDocumentService, DialogueVectorStoreService],
})
export class DialogueDocumentModule {}

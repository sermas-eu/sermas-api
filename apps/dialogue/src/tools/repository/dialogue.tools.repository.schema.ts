import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import {
  DialogueToolsRepositoryOptionsDto,
  DialogueToolsRepositoryRecordDto,
} from './dialogue.tools.repository.dto';

export type DialogueToolsRepositoryDocument =
  HydratedDocument<DialogueToolsRepository>;

@Schema()
export class DialogueToolsRepository extends DialogueToolsRepositoryRecordDto {
  @Prop({ index: true, unique: true })
  repositoryId: string;

  // @Prop({ index: true })
  // contextType: ContextType;

  @Prop({ index: true })
  appId: string;

  @Prop({ index: true, required: false })
  sessionId?: string;

  @Prop({ index: true, required: false })
  contextId: string;

  @Prop({
    index: true,
    type: MongooseSchema.Types.Array,
  })
  tools: AppToolsDTO[];

  @Prop({ default: () => ({}) })
  options?: DialogueToolsRepositoryOptionsDto;

  @Prop({ default: () => new Date() })
  created: Date;

  @Prop({ default: () => new Date() })
  updated: Date;
}

export const DialogueToolsRepositorySchema = SchemaFactory.createForClass(
  DialogueToolsRepository,
);

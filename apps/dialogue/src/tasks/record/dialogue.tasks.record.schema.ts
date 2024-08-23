import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { TaskEventType } from '../store/dialogue.tasks.store.dto';
import {
  DialogueTaskRecordDto,
  TaskRecordValues,
} from './dialogue.tasks.record.dto';

export type DialogueTaskRecordDocument = HydratedDocument<DialogueTaskRecord>;

@Schema()
export class DialogueTaskRecord extends DialogueTaskRecordDto {
  @Prop({ index: true, unique: true })
  recordId: string;

  @Prop({ index: true })
  taskId: string;

  @Prop({ index: true })
  appId: string;

  @Prop({ index: true })
  sessionId: string;

  @Prop({ index: true, type: String })
  status?: TaskEventType;

  @Prop({ index: true, type: MongooseSchema.Types.Map, default: () => ({}) })
  values: TaskRecordValues;

  @Prop({ index: true, default: () => new Date() })
  updated: Date;

  @Prop({ index: true, default: () => new Date() })
  created: Date;
}

export const DialogueTaskRecordSchema =
  SchemaFactory.createForClass(DialogueTaskRecord);

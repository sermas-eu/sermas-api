import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import {
  DialogueTaskDto,
  TaskEventDto,
  TaskFieldDto,
  TaskIntentDto,
  TaskOptionsDto,
} from './dialogue.tasks.store.dto';

export type DialogueTaskStoreDocument = HydratedDocument<DialogueTaskStore>;

@Schema()
export class DialogueTaskStore extends DialogueTaskDto {
  @Prop({ index: true, unique: true })
  taskId: string;

  @Prop({ index: true })
  appId: string;

  @Prop({ index: true, required: false })
  sessionId?: string;

  @Prop({ index: true })
  name: string;

  @Prop({ index: true, required: false })
  label?: string;

  @Prop({ index: true })
  description?: string;

  @Prop({ index: true, required: false })
  hint?: string;

  @Prop({ index: true, type: MongooseSchema.Types.Array })
  events?: TaskEventDto[];

  @Prop({ index: true, type: MongooseSchema.Types.Array })
  intents?: TaskIntentDto[];

  @Prop({ index: true, type: MongooseSchema.Types.Array })
  fields: TaskFieldDto[];

  @Prop({ type: MongooseSchema.Types.Map })
  options?: TaskOptionsDto;
}

export const DialogueTaskStoreSchema =
  SchemaFactory.createForClass(DialogueTaskStore);

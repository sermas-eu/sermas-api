import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import {
  DialogueMemoryDto,
  DialogueMemoryMessageDto,
} from './dialogue.memory.dto';

export type DialogueMemoryDocument = HydratedDocument<DialogueMemory>;

@Schema()
export class DialogueMemory extends DialogueMemoryDto {
  @Prop({ index: true, unique: true })
  sessionId: string;

  @Prop({ index: true, type: MongooseSchema.Types.Array })
  messages: DialogueMemoryMessageDto[];

  @Prop({ default: () => new Date() })
  created: Date;
}

export const DialogueMemorySchema =
  SchemaFactory.createForClass(DialogueMemory);

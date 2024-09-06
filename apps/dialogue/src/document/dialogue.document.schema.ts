import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  DialogueDocumentDto,
  DialogueDocumentMetadataDto,
} from './dialogue.document.dto';

export type DialogueDocumentDocument = HydratedDocument<DialogueDocument>;

@Schema()
export class DialogueDocument extends DialogueDocumentDto {
  @Prop({ index: true })
  appId: string;
  @Prop({ index: true })
  documentId: string;
  @Prop()
  content: string;
  @Prop({ index: true, type: Object, default: () => ({}) })
  metadata?: DialogueDocumentMetadataDto;
  @Prop({ default: () => new Date() })
  created: Date;
  @Prop({ default: () => new Date() })
  updated: Date;
}

export const DialogueDocumentSchema =
  SchemaFactory.createForClass(DialogueDocument);

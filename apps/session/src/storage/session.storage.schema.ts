import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { SessionStorageRecordDto } from './session.storage.dto';

export type SessionStorageDocument = HydratedDocument<SessionStorage>;

@Schema()
export class SessionStorage extends SessionStorageRecordDto {
  @Prop({ index: true, unique: true, required: true })
  storageId: string;

  @Prop({ required: true, index: true })
  appId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ index: true, default: () => ({}), type: MongooseSchema.Types.Map })
  data: Record<string, any>;

  @Prop({ required: false, index: true })
  sessionId?: string;

  @Prop({ default: () => new Date() })
  ts: Date;
}

export const SessionStorageSchema =
  SchemaFactory.createForClass(SessionStorage);

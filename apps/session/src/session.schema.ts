import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AppSettingsDto } from 'apps/platform/src/app/platform.app.dto';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import {
  SessionDto,
  SessionProperties,
  UserReferenceDto,
  UserReferenceSource,
} from './session.dto';

export type SessionDocument = HydratedDocument<Session>;

export class UserReference extends UserReferenceDto {
  @Prop({ index: true })
  userId: string;
  @Prop({ type: String, index: true })
  source: UserReferenceSource;
}

@Schema()
export class Session extends SessionDto {
  @Prop({ index: true, unique: true, required: true })
  sessionId: string;
  @Prop({ required: true })
  appId: string;
  @Prop({ required: true })
  agentId: string;
  @Prop({ index: true, default: [], type: MongooseSchema.Types.Array })
  user: UserReference[];
  @Prop({ index: true, default: undefined })
  userId: string;
  @Prop({ default: () => new Date() })
  createdAt: Date;
  @Prop({ default: () => new Date(), index: true })
  modifiedAt: Date;
  @Prop({ index: true, required: false, default: null })
  closedAt: Date | null;
  @Prop({ index: true, default: {}, type: MongooseSchema.Types.Map })
  settings: AppSettingsDto;
  @Prop({ index: true, default: {}, type: MongooseSchema.Types.Map })
  properties?: SessionProperties;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserPrivacyDto } from './ui.privacy.dto';

@Schema()
export class UserPrivacy extends UserPrivacyDto {}

export const UserPrivacySchema = SchemaFactory.createForClass(UserPrivacy);

export type UserPrivacySchemaDocument = HydratedDocument<UserPrivacy>;

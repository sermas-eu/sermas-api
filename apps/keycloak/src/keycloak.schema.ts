import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KeycloakConfigDocument = HydratedDocument<MongoKeycloakConfig>;

@Schema()
export class MongoKeycloakConfig {
  @Prop()
  realm: string;
  @Prop()
  clients: [];
  @Prop()
  roles: [];
  @Prop()
  groups: [];
  @Prop()
  users: [];
}

export const KeycloakConfigSchema =
  SchemaFactory.createForClass(MongoKeycloakConfig);

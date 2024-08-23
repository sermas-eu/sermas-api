import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DialogueTaskDto } from 'apps/dialogue/src/tasks/store/dialogue.tasks.store.dto';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { ModuleSettingsDto } from '../mod/mod.dto';
import {
  AppClientDto,
  AppModuleConfigDto,
  AppSettingsDto,
  AppToolsDTO,
  PlatformAppDto,
  RepositoryConfigDto,
} from './platform.app.dto';

export type PlatformAppDocument = HydratedDocument<PlatformApp>;

export class AppClient extends AppClientDto {
  @Prop()
  clientId: string;
  @Prop()
  permissions: string[];
}

export class AppModuleConfig extends AppModuleConfigDto {
  @Prop()
  moduleId: string;
  @Prop({ type: Object })
  config?: ModuleSettingsDto;
  @Prop({ type: [String] })
  supports: string[];
}

@Schema()
export class PlatformApp extends PlatformAppDto {
  @Prop({ index: true, unique: true })
  appId: string;

  @Prop({ index: true, default: () => false })
  public?: boolean;

  @Prop({ index: true })
  name: string;

  @Prop({})
  description?: string;

  @Prop({ index: true })
  ownerId: string;

  @Prop({ index: true, type: MongooseSchema.Types.Array })
  modules: AppModuleConfig[];

  @Prop({ index: true, type: MongooseSchema.Types.Map })
  repository: RepositoryConfigDto;

  @Prop({ type: MongooseSchema.Types.Array })
  clients: AppClientDto[];

  @Prop({ type: MongooseSchema.Types.Map, required: false })
  settings?: AppSettingsDto;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;

  @Prop({ default: () => [], type: MongooseSchema.Types.Array })
  tools: AppToolsDTO[];

  @Prop({ default: () => [], type: MongooseSchema.Types.Array })
  tasks: DialogueTaskDto[];
}

export const PlatformAppSchema = SchemaFactory.createForClass(PlatformApp);

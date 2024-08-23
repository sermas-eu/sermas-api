import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { ModuleSettingsDto, PlatformModuleConfigDto } from './mod.dto';

export type PlatformModuleConfigDocument =
  HydratedDocument<PlatformModuleConfig>;

@Schema()
export class PlatformModuleConfig extends PlatformModuleConfigDto {
  @Prop({ index: true, required: true, unique: true })
  moduleId: string;

  @Prop({ index: true, required: false })
  appId?: string;

  @Prop({ index: true, required: false })
  name?: string;

  @Prop({ index: true, required: false, default: () => 'enabled' })
  status?: 'enabled' | 'disabled' | 'failure';

  @Prop({ index: true, required: false })
  description?: string;

  @Prop({ index: true, required: false, type: MongooseSchema.Types.Array })
  supports: string[];

  @Prop({ index: true, required: false, type: MongooseSchema.Types.Map })
  config?: ModuleSettingsDto;
}

export const PlatformModuleConfigSchema =
  SchemaFactory.createForClass(PlatformModuleConfig);

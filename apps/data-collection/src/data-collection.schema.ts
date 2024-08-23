import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  DataCollectionDataRecordDto,
  DataCollectionSessionDto,
} from './data-collection.dto';

export type DataCollectionSessionDocument =
  HydratedDocument<DataCollectionSession>;

@Schema()
export class DataCollectionSession extends DataCollectionSessionDto {
  @Prop({ index: true })
  groupId: string;
  @Prop({ index: true, unique: true })
  sessionId: string;
  @Prop()
  label: string;
  @Prop()
  authorId: string;
  @Prop({ default: () => new Date() })
  created_at: Date;
  @Prop({ default: () => new Date() })
  modified_at: Date;
  @Prop({ type: Object, default: [] })
  records: DataCollectionDataRecordDto[];
}

export const DataCollectionSessionSchema = SchemaFactory.createForClass(
  DataCollectionSession,
);

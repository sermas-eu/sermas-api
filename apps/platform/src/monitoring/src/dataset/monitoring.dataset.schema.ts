import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DatasetRecordDto, LogType } from './monitoring.dataset.dto';

export type DatasetRecordDocument = HydratedDocument<DatasetRecord>;

@Schema()
export class DatasetRecord extends DatasetRecordDto {
  @Prop({ type: String })
  type: LogType;
  @Prop({ type: String })
  label: string;
  @Prop({ type: Object })
  data: any;
  @Prop()
  sessionId: string;
  @Prop({ default: () => new Date() })
  ts: Date;
}

export const DatasetRecordSchema = SchemaFactory.createForClass(DatasetRecord);

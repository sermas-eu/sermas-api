import { Prop } from '@nestjs/mongoose';

export class UserPrivacyDto {
  @Prop()
  date: Date;
  @Prop()
  ip: string;
  @Prop()
  accepted: boolean;
}

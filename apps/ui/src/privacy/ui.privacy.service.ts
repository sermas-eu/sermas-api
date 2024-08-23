import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UserPrivacy, UserPrivacySchemaDocument } from './ui.privacy.schema';
import { Model } from 'mongoose';

@Injectable()
export class UiPrivacyService {
  private readonly logger: Logger;

  constructor(
    @InjectModel(UserPrivacy.name)
    private readonly userPrivacyModel: Model<UserPrivacySchemaDocument>,
  ) {
    this.logger = new Logger(UiPrivacyService.name);
  }

  async updatePrivacyPolicy(ip: string) {
    this.logger.log(`Updating privacy policy for IP: ${ip}`);

    await this.userPrivacyModel.insertMany([
      {
        ip,
        date: new Date(),
        accepted: true,
      },
    ]);
  }
}

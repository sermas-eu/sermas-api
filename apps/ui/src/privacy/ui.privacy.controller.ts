import { Controller, Post, Req } from '@nestjs/common';
import { UiPrivacyService } from './ui.privacy.service';
import { Request } from 'express';

@Controller('ui')
export class UiPrivacyController {
  constructor(private readonly uiPrivacyService: UiPrivacyService) {}

  @Post('privacy')
  async updatePrivacyPolicy(@Req() req: Request) {
    await this.uiPrivacyService.updatePrivacyPolicy(req.ip);
  }
}

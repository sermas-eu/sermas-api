import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '#libs/auth/jwt.guard';
import { UiPrivacyService } from './ui.privacy.service.js';
import { Request } from 'express';

@Controller('ui')
export class UiPrivacyController {
  constructor(private readonly uiPrivacyService: UiPrivacyService) {}

  // a verified token is required: unauthenticated callers could fill the
  // collection (D-36); the kiosk sends its app token
  @Post('privacy')
  @UseGuards(JwtAuthGuard)
  async updatePrivacyPolicy(@Req() req: Request) {
    await this.uiPrivacyService.updatePrivacyPolicy(req.ip);
  }
}

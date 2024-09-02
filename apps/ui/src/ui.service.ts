import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { LLMTranslationService } from 'libs/translation/translation.service';
import { toDataURL } from 'qrcode';
import { UIAsyncApiService } from './ui.async.service';
import {
  ButtonsContentDto,
  QuizContentDto,
  UIContentDto,
} from './ui.content.dto';
import { QrCodeDto, QrCodePayloadDto, UIInteractionEventDto } from './ui.dto';

@Injectable()
export class UIService {
  private readonly logger = new Logger(UIService.name);

  constructor(
    private readonly async: UIAsyncApiService,
    private readonly emitter: EventEmitter2,
    private readonly session: SessionService,
    private readonly translation: LLMTranslationService,
  ) {}

  // onModuleInit() {
  //   const contents: UIContentDto[] = [
  //     // {
  //     //   appId: 'mimex',
  //     //   type: 'image',
  //     //   content: {
  //     //     src: 'https://sermasproject.eu/wp-content/uploads/2023/08/sermas-xr-homepage.png',
  //     //     height: 250,
  //     //     alt: 'SERMAS robot',
  //     //   }
  //     // } as ImageUIContentDto,
  //     // {
  //     //   appId: 'mimex',
  //     //   type: 'webpage',
  //     //   content: {
  //     //     url: 'https://example.com',
  //     //   }
  //     // } as WebpageUIContentDto,
  //     // {
  //     //   appId: 'mimex',
  //     //   type: 'email',
  //     //   content: {
  //     //     email: 'info@sermasproject.eu',
  //     //     label: 'Contact sales'
  //     //   }
  //     // } as EmailUIContentDto,
  //     // {
  //     //   appId: 'mimex',
  //     //   type: 'html',
  //     //   content: {
  //     //     html: `<div class="title">Hello world</div>`
  //     //   }
  //     // } as HtmlUIContentDto,
  //   ];

  //   // let i = 0
  //   // setInterval(() => {
  //   //   if (!contents[i]) return
  //   //   this.logger.debug(`Send content ${contents[i].type}`)
  //   //   this.showContent(contents[i])
  //   //   i++
  //   //   if (i === contents.length) i = 0
  //   // }, 5000)
  // }

  // async getAssetUrl(path: string): Promise<string> {
  //   return await this.minioService.client.presignedGetObject(
  //     REPOSITORY_BUCKET,
  //     path,
  //     60 * 60, // 1 hr expiration
  //   );
  // }

  // clear screen on session close
  async onSessionChanged(ev: SessionChangedDto) {
    if (!(ev.operation === 'updated' && ev.record.closedAt)) {
      return;
    }

    this.logger.debug(`Send clear screen sessionId=${ev.record.sessionId}`);
    this.showContent({
      appId: ev.appId,
      sessionId: ev.record.sessionId,
      contentType: 'clear-screen',
      content: {},
    });
  }

  async showContent(uiContent: UIContentDto) {
    this.logger.debug(
      `send content contentType=${uiContent.contentType} appId=${uiContent.appId} sessionId=${uiContent.sessionId}`,
    );

    uiContent.ts = uiContent.ts || new Date();
    uiContent.chunkId = uiContent.chunkId || getChunkId(uiContent.ts);

    if (uiContent.options?.language) {
      const toLanguage = await this.session.getLanguage(uiContent);
      if (toLanguage) {
        const fromLanguage = uiContent.options?.language;

        const content1 = uiContent.content as any;

        // buttons
        if (content1.list) {
          const buttonContent = content1 as ButtonsContentDto;

          const parts: string[] = [];

          if (buttonContent.label) parts.push(buttonContent.label);

          parts.push(...buttonContent.list.map((b) => b.label || b.value));

          const translations = await this.translateTexts(
            parts,
            fromLanguage,
            toLanguage,
          );

          if (buttonContent.label) {
            const label = translations.shift();
            if (label) {
              buttonContent.label = label;
            }
          }

          translations.forEach((t, i) => {
            if (buttonContent.list[i]) buttonContent.list[i].label = t;
          });

          uiContent.content = buttonContent;
        }

        // quiz
        if (content1.answers) {
          const quizContent = content1 as QuizContentDto;

          const parts = [
            quizContent.question || '',
            ...quizContent.answers.map((a) => a.answer),
          ];

          const translations = await this.translateTexts(
            parts,
            fromLanguage,
            toLanguage,
          );

          quizContent.question = translations.shift();

          quizContent.answers = quizContent.answers.map((a, i) => {
            a.answer = translations[i];
            return a;
          });

          uiContent.content = quizContent;
        }
      }
    }

    this.emitter.emit('ui.content', uiContent);
    await this.async.content(uiContent);
  }

  async translateTexts(
    sources: string[],
    fromLanguage: string,
    toLanguage: string,
  ): Promise<string[]> {
    try {
      if (!sources || fromLanguage === toLanguage) return sources;

      const raw = await this.translation.translate(
        JSON.stringify(sources),
        fromLanguage,
        toLanguage,
      );

      if (raw) {
        try {
          const translations = JSON.parse(raw);
          return translations;
        } catch (e) {
          this.logger.warn(
            `Translation failed, cannot parse LLM response: ${e.message}`,
          );
          this.logger.debug(raw);
        }
      }

      return sources;
    } catch (e) {
      this.logger.warn(`Translation failed: ${e.message}`);
      return sources;
    }
  }

  async interaction(payload: UIInteractionEventDto) {
    this.logger.debug(
      `UI interaction sessionId=${payload.sessionId} element=${payload.interaction.element}`,
    );
    this.emitter.emit('ui.interaction', payload);
    await this.async.interaction(payload);
  }

  async generateQRCode(payload: QrCodePayloadDto): Promise<QrCodeDto> {
    try {
      const qr = await toDataURL(payload.data, {
        version: payload.version,
      });
      return { imageDataUrl: qr };
    } catch (err) {
      this.logger.error('QR code generation error', err);
      return { imageDataUrl: null };
    }
  }
}

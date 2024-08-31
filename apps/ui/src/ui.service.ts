import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { LLMTranslationService } from 'libs/translation/translation.service';
import { toDataURL } from 'qrcode';
import { UIAsyncApiService } from './ui.async.service';
import { UIContentDto } from './ui.content.dto';
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

        const content = uiContent.content as any;
        if (content.label) {
          const label = await this.translation.translate(
            content.label,
            fromLanguage,
            toLanguage,
          );
          if (label) content.label = label;
        }

        // buttons
        if (content.list) {
          for (const b of content.list) {
            const srcLabel = b.label || b.value;
            if (!srcLabel) continue;
            const label = await this.translation.translate(
              srcLabel,
              fromLanguage,
              toLanguage,
            );
            if (label) b.label = label;
          }
        }

        uiContent.content = content;
      }
    }

    this.emitter.emit('ui.content', uiContent);
    await this.async.content(uiContent);
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

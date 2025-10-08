import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  createSessionContext,
  SessionContext,
} from 'apps/session/src/session.context';
import { SessionChangedDto } from 'apps/session/src/session.dto';
import { SessionService } from 'apps/session/src/session.service';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { LLMTranslationService } from 'libs/translation/translation.service';
import { toDataURL } from 'qrcode';
import { ulid } from 'ulidx';
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

  // clear screen on session close
  async onSessionChanged(ev: SessionChangedDto) {
    if (!(ev.operation === 'updated' && ev.record.closedAt)) {
      return;
    }

    this.logger.verbose(`Send clear screen sessionId=${ev.record.sessionId}`);
    await this.sendClearScreen({
      appId: ev.appId,
      sessionId: ev.record.sessionId,
    });
  }

  sendClearScreen(ev: { appId: string; sessionId: string }) {
    return this.showContent({
      appId: ev.appId,
      sessionId: ev.sessionId,
      contentType: 'clear-screen',
      content: {},
    });
  }

  async showContent(uiContent: UIContentDto) {
    this.logger.verbose(
      `send content contentType=${uiContent.contentType} appId=${uiContent.appId} sessionId=${uiContent.sessionId}`,
    );

    uiContent.requestId = uiContent.requestId || ulid();

    uiContent.ts = uiContent.ts || new Date();
    uiContent.chunkId = uiContent.chunkId || getChunkId(uiContent.ts);

    uiContent = await this.handleTranslation(uiContent);

    // this.emitter.emit('ui.content', uiContent);
    await this.async.content(uiContent);
  }

  async handleTranslation(uiContent: UIContentDto) {
    const toLanguage = await this.session.getLanguage(uiContent);
    if (!toLanguage) return uiContent;

    const fromLanguage = uiContent.options?.language;

    if (toLanguage === fromLanguage) {
      this.logger.debug(
        `UI content has same language=${fromLanguage} skip translation.`,
      );
      return uiContent;
    }

    const rawContent = uiContent.content as any;

    // buttons
    if (uiContent.contentType === 'buttons' && rawContent.list) {
      const buttonContent = rawContent as ButtonsContentDto;

      const parts: string[] = [];

      if (buttonContent.label) parts.push(buttonContent.label);

      parts.push(...buttonContent.list.map((b) => b.label || b.value));

      const translations = await this.translateTexts(
        parts,
        fromLanguage,
        toLanguage,
        createSessionContext(uiContent),
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
    if (uiContent.contentType === 'quiz' && rawContent.answers) {
      const quizContent = rawContent as QuizContentDto;

      const parts = [
        quizContent.question || '',
        ...quizContent.answers.map((a) => a.answer),
      ];

      const translations = await this.translateTexts(
        parts,
        fromLanguage,
        toLanguage,
        createSessionContext(uiContent),
      );

      quizContent.question = translations.shift();

      quizContent.answers = quizContent.answers.map((a, i) => {
        a.answer = translations[i];
        return a;
      });

      uiContent.content = quizContent;
    }

    return uiContent;
  }

  async translateTexts(
    sources: string[],
    fromLanguage: string,
    toLanguage: string,
    sessionContext?: SessionContext,
  ): Promise<string[]> {
    try {
      if (!sources || fromLanguage === toLanguage) return sources;

      const raw = await this.translation.translate(
        JSON.stringify(sources),
        fromLanguage,
        toLanguage,
        sessionContext,
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

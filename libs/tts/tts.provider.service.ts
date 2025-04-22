import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarkAITextToSpeech } from './providers/tts.bark-ai.provider';
import { ElevenIOTextToSpeech } from './providers/tts.elevenio.provider';
import { GoogleTextToSpeech } from './providers/tts.google.provider';
import { OpenAITextToSpeech } from './providers/tts.openai.provider';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from 'apps/session/src/session.service';
import { Cache } from 'cache-manager';
import { MonitorService } from 'libs/monitor/monitor.service';
import { mapLanguageCode } from '../language/language';
import { AzureTextToSpeech } from './providers/tts.azure.provider';
import { SSMLService } from './ssml/ssml.service';
import { DialogueTextToSpeechDto, SpeakParam } from './tts.dto';

import {
  createSessionContext,
  SessionContext,
} from 'apps/session/src/session.context';
import { hash } from 'libs/util';

@Injectable()
export class TTSProviderService {
  private readonly logger = new Logger(TTSProviderService.name);

  constructor(
    private readonly googletts: GoogleTextToSpeech,
    private readonly barkaitts: BarkAITextToSpeech,
    private readonly openaitts: OpenAITextToSpeech,
    private readonly azuretts: AzureTextToSpeech,
    private readonly eleveniotts: ElevenIOTextToSpeech,

    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly emitter: EventEmitter2,

    private readonly ssmlService: SSMLService,

    private readonly monitor: MonitorService,

    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  normalizeText(text: string): string | undefined {
    if (!text || !text.length) return undefined;

    // do not translate links and markdown
    try {
      text = text.replace(/https?:\/\/[^\s]+/g, '');
      text = text.replace(/!\[.*?\]\(.*?\)/g, ''); // Rimuove immagini Markdown ![alt text](url)
      text = text.replace(/\[.*?\]\(.*?\)/g, ''); // Rimuove link Markdown [text](url)
      text = text.replace(/[_*~`>#+-]/g, ' '); // Rimuove altri caratteri Markdown (_ * ~ ` > # + -)
      // remove emoticons
      text = text.replace(
        /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
        ' ',
      );

      // cleanup formatting
      text = text
        .replace(/\n|\t|\r/gm, ' ')
        .replace(/ +/gm, ' ')
        .trim();
    } catch (e) {
      this.logger.warn('Error applying text filtering');
      return undefined;
    }

    return text.length ? text : undefined;
  }

  async generateSSML(data: {
    ev: DialogueTextToSpeechDto;
    params: SpeakParam;
    sessionContext: SessionContext;
  }): Promise<string | undefined> {
    const { params, ev, sessionContext } = data;

    if (params.ssml || !params.text) return params.ssml || undefined;

    const ssmlGenerate = this.config.get('SSML_GENERATE') === '1';
    if (!ssmlGenerate) return undefined;

    const session = await this.session.read(ev.sessionId, false);
    let context = '';
    if (session && session.settings?.prompt?.text) {
      context = `Your application context is: ${session.settings?.prompt?.text?.replace(/\n/g, ' ')}`;
    }

    return await this.ssmlService.generate(
      {
        text: params.text,
        language: params.languageCode,
        emotion: params.emotion,
        context,
      },
      sessionContext,
    );
  }

  async generateTTS(ev: DialogueTextToSpeechDto): Promise<Buffer> {
    if (!ev.text && !ev.ssml) return Buffer.from([]);

    const settings = await this.session.getSettings(ev);
    // skip tts generation
    if (
      ev.ttsEnabled === false ||
      (settings && settings.ttsEnabled === false)
    ) {
      this.logger.verbose(
        `TTS disabled by settings for sessionId=${ev.sessionId}`,
      );
      return Buffer.from([]);
    }

    const perf = this.monitor.performance({
      ...ev,
      label: 'tts',
    });

    const ssml = ev.ssml;
    const text = this.normalizeText(ev.text);

    if (!text || !text.length) {
      this.logger.verbose('Empty text, skip');
      return Buffer.from([]);
    }

    // const [, raw] = await this.dataset.readRecord('tts', text || ssml);
    // if (raw) return raw;

    let ttsProvider = this.config.get('TTS_SERVICE');
    let ttsModel = undefined;

    const avatar = await this.session.getAvatar(ev);
    if (avatar && avatar.tts) {
      ttsProvider = avatar.tts?.provider || ttsProvider;
      ttsModel = avatar.tts?.model || ttsModel;
    }

    this.logger.verbose(
      `Generating TTS using ${ttsProvider}${ttsModel ? '/' + ttsModel : ''}`,
    );

    const sessionContext = createSessionContext(ev);

    const params: SpeakParam = {
      text,
      ssml,
      emotion: ev.emotion,
      gender: ev.gender,
      languageCode: mapLanguageCode(ev.language),
      provider: ttsProvider,
      model: ttsModel,
    };

    // generate SSML markup, if enabled
    params.ssml = await this.generateSSML({ ev, params, sessionContext });

    const cacheKey = hash(
      [
        params.ssml,
        params.text,
        params.languageCode,
        params.gender,
        ttsProvider,
        ttsModel || '',
      ].join(''),
    );

    const cached = await this.cache.get<Buffer>(cacheKey);
    if (cached) {
      perf('cached');
      return Buffer.from(cached);
    }

    let data: Buffer;
    switch (ttsProvider) {
      case 'barkai':
        data = await this.barkaitts.speak(params);
        perf('barkai');
        break;
      case 'google':
        data = await this.googletts.speak(params);
        perf('google');
        break;
      case 'azure':
        data = await this.azuretts.speak(params);
        perf('azure');
        break;
      case 'elevenio':
        data = await this.eleveniotts.speak(params);
        perf('elevenio');
        break;
      case 'openai':
      default:
        data = await this.openaitts.speak(params);
        perf('openai');
        break;
    }

    this.cache.set(cacheKey, data);

    this.emitter.emit('dialogue.speech.tts', {
      buffer: data,
      ...ev,
    });

    return data;
  }
}

import { parseVoiceMap, selectVoice } from './tts.openai.provider.js';

describe('OpenAI TTS voice selection', () => {
  const map = parseVoiceMap(
    ' it-F=if_sara, it-M=im_nicola ,en=af_heart,broken,=x',
  );

  it('parses lang[-gender]=voice entries and skips malformed ones', () => {
    expect(map).toEqual({
      'it-f': 'if_sara',
      'it-m': 'im_nicola',
      en: 'af_heart',
    });
  });

  it('matches language and gender, then language, then the default', () => {
    expect(selectVoice(map, 'it-IT', 'M', 'alloy')).toBe('im_nicola');
    expect(selectVoice(map, 'en-GB', 'M', 'alloy')).toBe('af_heart');
    expect(selectVoice(map, 'de-DE', 'F', 'alloy')).toBe('alloy');
    expect(selectVoice(map, undefined, undefined, 'alloy')).toBe('alloy');
  });
});

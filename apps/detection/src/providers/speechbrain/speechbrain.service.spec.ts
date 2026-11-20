import { ConfigService } from '@nestjs/config';
import {
  SpeechBrainSeparation,
  SpeechBrainSpeakerCount,
} from 'apps/detection/src/providers/speechbrain/speechbrain.dto';
import { SpeechBrainService } from 'apps/detection/src/providers/speechbrain/speechbrain.service';
import { readFile } from 'fs/promises';

const SECONDS = 1000;

// Needs a running SpeechBrain service and a fixture wav from the sermas-speechbrain
// repository (tests/data/01-s1s2s3_with_noise-...-0014.wav). Skipped unless set.
const TEST_WAV = process.env.SPEECHBRAIN_TEST_WAV;
const describeIfFixture = TEST_WAV ? describe : describe.skip;

describeIfFixture('SpeechBrainService', () => {
  let speechBrainService: SpeechBrainService;
  const config = new ConfigService();
  config.set(
    'SPEECHBRAIN_URL',
    process.env.SPEECHBRAIN_URL || 'http://127.0.0.1:5011',
  );
  beforeEach(async () => {
    speechBrainService = new SpeechBrainService(config);
  });

  describe('separate', () => {
    it(
      'split an audio recording into several sources',
      async () => {
        const testFile = TEST_WAV;
        const audio: Buffer = await readFile(testFile);
        const result = {
          speakerCount: { value: 2, probability: 0.05685618729096997 },
        } as SpeechBrainSeparation;
        expect(await speechBrainService.separate(audio)).toStrictEqual(result);
      },
      8 * SECONDS,
    );
  });

  describe('countSpeakers', () => {
    it('count the number of speakers in an audio recording', async () => {
      const testFile = TEST_WAV;
      const audio: Buffer = await readFile(testFile);
      const result = {
        speakerCount: { value: 2, probability: 0.05685618729096997 },
      } as SpeechBrainSpeakerCount;
      expect(await speechBrainService.countSpeakers(audio)).toStrictEqual(
        result,
      );
    });
  });
});

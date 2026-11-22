import { ConfigService } from '@nestjs/config';
import { SpeechBrainService } from '#apps/detection/src/providers/speechbrain/speechbrain.service';
import { EmotionTypes } from '#libs/sermas/sermas.dto';
import { readFile } from 'fs/promises';

// Needs a running SpeechBrain service and the fixture wavs of the sermas-speechbrain
// repository (its tests/data directory). Skipped unless SPEECHBRAIN_TEST_DATA is set.
const DATA = process.env.SPEECHBRAIN_TEST_DATA;
const describeIfFixture = DATA ? describe : describe.skip;

const SUFFIX = '-251-136532-0015_1993-147965-0008_7976-110124-0014.wav';
const wav = (name: string) => readFile(`${DATA}/${name}${SUFFIX}`);

describeIfFixture('SpeechBrainService', () => {
  let speechbrain: SpeechBrainService;

  beforeAll(async () => {
    const config = new ConfigService();
    config.set(
      'SPEECHBRAIN_URL',
      process.env.SPEECHBRAIN_URL || 'http://127.0.0.1:5011',
    );
    speechbrain = new SpeechBrainService(config);
    await speechbrain.onModuleInit();
  });

  it('classifies language and emotion as inference values', async () => {
    const result = await speechbrain.classify(await wav('04-s1_only'));
    expect(result).not.toBeNull();
    expect(EmotionTypes).toContain(result!.emotion.value);
    expect(result!.emotion.probability).toBeGreaterThanOrEqual(0);
    expect(result!.emotion.probability).toBeLessThanOrEqual(1.000001);
    expect(typeof result!.language.value).toBe('string');
    expect(typeof result!.language.probability).toBe('number');
  });

  it('tells the same speaker from another one', async () => {
    const s1 = await speechbrain.createEmbeddings(await wav('04-s1_only'));
    const s2 = await speechbrain.createEmbeddings(await wav('05-s2_only'));
    expect(typeof s1!.embeddings).toBe('string');

    const verified = await speechbrain.verifySpeakers(
      await wav('02-s1_with_noise'),
      [s1!.embeddings, s2!.embeddings, ''],
    );
    const [same, other, none] = verified!.similarities;
    expect(same).toBeGreaterThan(other!);
    expect(none).toBeNull();

    const { similarity_matrix } = (await speechbrain.similarityMatrix([
      s1!.embeddings,
      s2!.embeddings,
    ]))!;
    expect(similarity_matrix[0][0]).toBeCloseTo(1, 4);
    expect(similarity_matrix[0][1]).toBeCloseTo(similarity_matrix[1][0], 6);
  });
});

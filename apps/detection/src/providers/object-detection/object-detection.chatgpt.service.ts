import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LLMService } from 'libs/llm/llm.service';
import { ObjectDetectionDto } from '../../detection.dto';

@Injectable()
export class ChatGPTObjectDetectionService {
  private readonly logger = new Logger(ChatGPTObjectDetectionService.name);

  constructor(private readonly llm: LLMService) {}

  async onModuleInit() {
    // test
    // const content = await fs.readFile('/app/data/package.jpg');
    // const result = await this.detectObjectCarriedByPerson(content, [
    //   'box',
    //   'envelope',
    //   'package',
    //   'form',
    // ]);
    // this.logger.log(`Detection test result: ${JSON.stringify(result)}}`);
  }

  async detectObjectCarriedByPerson(
    image: Buffer,
    filter: string[] = [],
  ): Promise<[ObjectDetectionDto] | null> {
    if (filter.length === 0) {
      throw new BadRequestException('Filter list must not be empty');
    }
    const context = `Detect the objects carried by the person in the picture. Output a list of objects filtered by this list:
     [${filter.join(
       ', ',
     )}]. Answer with this json format: { “detections”: object_list }, where “detection” is the key and object_list is the value, for example: { “detections”: [“envelope”] }`;

    let content = '';
    try {
      const openai = this.llm.getOpenAIClient();

      if (!openai) {
        this.logger.error(
          'OpenAI client is not available, check configuration',
        );
        return null;
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: context },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image.toString('base64')}`,
                },
              },
            ],
          },
        ],
      });
      content = response.choices[0].message.content;
    } catch (e) {
      this.logger.error(`Error calling OPENAI: ${e.stack}`);
      return null;
    }

    this.logger.verbose(`Result: ${content}`);

    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      this.logger.error(`Error parsing result: ${e.stack}`);
      return null;
    }

    if (!result || !result.detections || !Array.isArray(result.detections)) {
      this.logger.error('No detections in result');
      return null;
    }

    return result.detections.map((d) => ({ value: d }) as ObjectDetectionDto);
  }
}

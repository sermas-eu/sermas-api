import { Injectable, Logger } from '@nestjs/common';
import { LanguageCode } from 'libs/language/lang-codes';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { Emotion } from 'libs/sermas/sermas.dto';

export class SSMLParams {
  text: string;
  emotion?: Emotion;
  language: LanguageCode;
  context?: string;
}

@Injectable()
export class SSMLService {
  private readonly logger = new Logger(SSMLService.name);

  constructor(private readonly llmProvider: LLMProviderService) {}

  async generate(params: SSMLParams) {
    if (!params.text) return params.text;

    try {
      const systemPrompt = `
${params.context ? params.context : ''}
You must create compliant Speech Synthesis Markup Language (SSML) for the user message.

Alter the user message adding the appropriate SSML tags to create an empathic output.
${params.emotion ? `Consider the emotion of the user is "${params.emotion}"` : ''}
${params.language ? `User language is "${params.language}"` : ''}

Answer exclusively in the SSML format, do not add notes or explanation

Follow these rules to properly render the SSML:

<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="string"> 
Use as the root element. set lang to the user language, if available

<break strength="string" time="string" /> 
Use the break element to override the default behavior of breaks or pauses between words. Otherwise the Speech service automatically inserts pauses.
- strength (optional) values: x-weak weak medium strong x-strong
- time (optional) e.g. 1s or 500ms

<s /> 
denotes sentences

<p /> 
denotes paragraphs

<emphasis level="string" />
Used to add or remove emphasis from text contained by the element. The <emphasis> element modifies speech similarly to <prosody>, but without the need to set individual speech attributes.
- level (optional) values: strong moderate none reduced

<say-as interpret-as="string" format="string" detail="string"> 
Use to wrap acronyms, numbers and sequences

`;

      const res = await this.llmProvider.chat({
        stream: false,
        json: false,
        system: systemPrompt,
        message: params.text,
        tag: 'chat',
      });

      if (!res) return params.text;

      let ssml = res;
      if (ssml.startsWith('```xml')) {
        ssml = ssml.replace(/^```xml/, '');
        if (ssml.endsWith('```')) {
          ssml.replace(/```$/, '');
        }
      }

      ssml.split('\n').forEach((line) => this.logger.debug(`SSML | ${line}`));

      return ssml;
    } catch (e: any) {
      this.logger.warn(`Failed to generate SSML: ${e.stack}`);
      return params.text;
    }
  }
}

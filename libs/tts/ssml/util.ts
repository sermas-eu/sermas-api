import { Logger } from '@nestjs/common';
import * as ssmlCheck from 'ssml-check-core';

const logger = new Logger('ssml.utils');

export const stripTags = (ssml: string) => (ssml || '').replace(/<[^>]*>/g, '');

// return ssml or text if ssml is not valid
export const fixSSML = async (
  ssml: string,
  text?: string,
  platform = 'all',
): Promise<{ ssml?: string; text?: string }> => {
  const ssmlCheckResult = await ssmlCheck.verifyAndFix(ssml, {
    platform,
  });
  if (ssmlCheckResult.errors) {
    if (ssmlCheckResult.fixedSSML) {
      ssml = ssmlCheckResult.fixedSSML;
    } else {
      logger.warn(
        `Invalid SSML detected: ${JSON.stringify(ssmlCheckResult.errors)}`,
      );
      ssml = '';
      // strip tags
      return {
        ssml: undefined,
        text: text || stripTags(ssml),
      };
    }
  }
  return { ssml };
};

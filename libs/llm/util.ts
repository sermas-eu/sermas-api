import { Logger } from '@nestjs/common';

const logger = new Logger('llm.util');

export const parseJSON = <T = any>(response: string): T | null => {
  if (!response) return null;

  try {
    // handle ```json
    if (response.startsWith('```')) {
      response = response.substring(3);
      if (response.substring(0, 4) === 'json') {
        response = response.substring(4);
      }
      response = response.substring(0, response.length - 3); // remove closing md tag ```
    }

    return JSON.parse(response) as T;
  } catch (e: any) {
    logger.error(`Failed to parse JSON: ${e.message}`);
    logger.debug(`RAW response: ${response}`);

    return null;
  }
};

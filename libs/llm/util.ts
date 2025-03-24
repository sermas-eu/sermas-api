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

    if (response.substring(response.length - 1) === '`') {
      response = response.substring(0, response.length - 1);
    }

    return JSON.parse(response) as T;
  } catch (e: any) {
    logger.error(`Failed to parse JSON: ${e.message}`);
    logger.debug(`RAW response: ${response}`);

    return null;
  }
};

export const extractProviderName = (service: string) => {
  const data: { provider: string; model: string } = {
    provider: undefined,
    model: undefined,
  };
  if (!service) return data;
  const parts = service.split('/');
  if (parts.length) {
    data.provider = parts.shift();
    if (parts.length) data.model = parts.join('/');
  }
  return data;
};

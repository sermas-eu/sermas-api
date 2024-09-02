import OpenAI, { ClientOptions } from 'openai';
import { LLMProviderConfig } from '../provider.dto';

export const createClient = (config: LLMProviderConfig) => {
  const { apiKey, baseURL } = config;
  const params: ClientOptions = {};
  params.apiKey = params.apiKey || apiKey;
  if (baseURL) params.baseURL = baseURL;

  return new OpenAI(params);
};

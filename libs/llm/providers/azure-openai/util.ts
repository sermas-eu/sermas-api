import { AzureOpenAI, AzureClientOptions } from 'openai';
import { LLMProviderConfig } from '../provider.dto';
// import { AzureKeyCredential } from '@azure/openai';

export const createChatClient = (config: LLMProviderConfig) => {
  const { apiKey, baseURL, model, apiVersion } = config;
  const params: AzureClientOptions = {};
  params.apiKey = params.apiKey || apiKey;
  if (baseURL) params.baseURL = baseURL;
  if (apiVersion) params.apiVersion = apiVersion;

  params.baseURL = `${params.baseURL}/openai/deployments/${model}/chat/completions?api-version=${params.apiVersion}`;

  return new AzureOpenAI(params);
};

export const createEmbeddingClient = (config: LLMProviderConfig) => {
  const { apiKey, baseURL, model, apiVersion } = config;
  const params: AzureClientOptions = {};
  params.apiKey = params.apiKey || apiKey;
  if (baseURL) params.baseURL = baseURL;
  if (apiVersion) params.apiVersion = apiVersion;

  params.baseURL = `${params.baseURL}/openai/deployments/${model}/embeddings?api-version=${params.apiVersion}`;

  return new AzureOpenAI(params);
};

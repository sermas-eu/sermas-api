import { PromptTemplate } from 'libs/llm/prompt/prompt.template';

type SentimentAnalysisPrompt = {
  emotions: string;
  defaultEmotion: string;
};

export const sentimentAnalysisPrompt =
  PromptTemplate.create<SentimentAnalysisPrompt>(
    'sentiment-analysis',
    `
Your task is to detect sentiment from the text.
Valid options are: <%= data.emotions %>

If not options matches, answer with emotion <%= data.defaultEmotion %> and probability 1.0

Return only a valid JSON response in this format. Do not add notes or explanations.
{ "emotion": string, "probability": number }`,
  );

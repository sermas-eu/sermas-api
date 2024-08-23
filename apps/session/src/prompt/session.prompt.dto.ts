import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMProvider, LLMProviderList } from 'libs/llm/providers/provider.dto';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';
import { AgentEvaluatePromptOptionsDto } from '../agent/session.agent.dto';

export class AgentEvaluatePromptDto extends SermasSessionDto {
  @ApiProperty({
    description: 'Id of the session',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Prompt to evaluate',
  })
  prompt: string;

  @ApiPropertyOptional({
    description: 'Prompt options',
  })
  options?: AgentEvaluatePromptOptionsDto;

  @ApiPropertyOptional({
    description: 'LLM provider',
    enum: LLMProviderList,
    enumName: 'LLMProvider',
  })
  provider?: LLMProvider;

  @ApiPropertyOptional({
    description: 'LLM provider model name',
  })
  model?: string;
}

export const AgentEvaluatePromptFormatList = ['text', 'string'];

export type AgentEvaluatePromptFormat =
  (typeof AgentEvaluatePromptFormatList)[number];

export class AgentEvaluatePromptResponseDto {
  @ApiProperty({
    description: 'Result of the call',
    type: Object,
  })
  result: string | object;
  @ApiProperty({
    description: `Response format (${AgentEvaluatePromptFormatList})`,
    enum: AgentEvaluatePromptFormatList,
    enumName: 'AgentEvaluatePromptFormat',
  })
  format: AgentEvaluatePromptFormat;
}

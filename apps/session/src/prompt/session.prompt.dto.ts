import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMProvider, LLMProviderList } from '#libs/llm/providers/provider.dto';
import { SermasSessionDto } from '#libs/sermas/sermas.dto';
import { AgentEvaluatePromptOptionsDto } from '../agent/session.agent.dto.js';

export class AgentEvaluatePromptDto extends SermasSessionDto {
  @ApiProperty({
    description: 'Id of the session',
  })
  @IsOptional()
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Prompt to evaluate',
  })
  @IsOptional()
  @IsString()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Prompt options',
  })
  @IsOptional()
  @IsObject()
  options?: AgentEvaluatePromptOptionsDto;

  @ApiPropertyOptional({
    description: 'LLM provider',
    enum: LLMProviderList,
    enumName: 'LLMProvider',
  })
  @IsOptional()
  @IsString()
  provider?: LLMProvider;

  @ApiPropertyOptional({
    description: 'LLM provider model name',
  })
  @IsOptional()
  @IsString()
  model?: string;
}

export const AgentEvaluatePromptFormatList = ['text', 'string'];

export type AgentEvaluatePromptFormat =
  (typeof AgentEvaluatePromptFormatList)[number];

export class AgentEvaluatePromptResponseDto {
  @ApiProperty({
    description: 'Result of the call',
    type: String,
  })
  result: string;
  @ApiProperty({
    description: `Response format (${AgentEvaluatePromptFormatList})`,
    enum: AgentEvaluatePromptFormatList,
    enumName: 'AgentEvaluatePromptFormat',
  })
  format: AgentEvaluatePromptFormat;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppSettingsDto,
  AppToolsDTO,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { LLMCallResult } from 'libs/llm/providers/provider.dto';
import {
  ActiveTaskRecord,
  IntentActiveTools,
  TaskFilterWrapper,
  TaskIntentWrapper,
} from '../intent/dialogue.intent.dto';
import {
  DialogueTaskDto,
  TaskFieldDto,
} from '../tasks/store/dialogue.tasks.store.dto';
import { DialogueToolsRepositoryDto } from '../tools/repository/dialogue.tools.repository.dto';
import { SelectedTool } from './dialogue.chat.tools.dto';

export type MatchingToolsResult = {
  matches?: Record<string, Record<string, any>>;
  explain?: string;
};

export type ToolsWrapper = {
  matches?: SelectedTool[];
  explain?: string;
};

export type LLMParsedResult = {
  tools?: ToolsWrapper;
  intent?: TaskIntentWrapper;
  filter?: TaskFilterWrapper;
};

export type LLMChatData = {
  data: {
    appId: string;
    sessionId: string;
    settings?: Partial<AppSettingsDto>;
    activeTools: IntentActiveTools;
    currentField?: TaskFieldDto;
    activeTask?: ActiveTaskRecord;
    tasks?: DialogueTaskDto[];
    avatar?: RepositoryAvatarDto;
  };
};

export type LLMCombinedResult = LLMCallResult & LLMParsedResult & LLMChatData;

export class DialogueChatValidationEvent {
  skip: boolean;
  appId: string;
  sessionId: string;
  message: DialogueMessageDto;
}
export class DialogueChatProgressEvent {
  requestId: string;
  sessionId: string;
  appId: string;
  messageId: string;
  chunkId?: string;
  // indicate if the generation has completed
  completed: boolean;
}
export class DialogueToolNotMatchingDto {
  appId: string;
  sessionId: string;
  tools: AppToolsDTO[];
  repositories: DialogueToolsRepositoryDto[];
  currentTask?: DialogueTaskDto;
  currentField?: TaskFieldDto;
}

export class DialogueToolNotMatchingEventDto {
  @ApiProperty()
  appId: string;
  @ApiProperty()
  sessionId: string;
  @ApiProperty({
    type: [AppToolsDTO],
  })
  tools: AppToolsDTO[];
  @ApiProperty({
    type: [String],
  })
  repositories: string[];
  @ApiPropertyOptional()
  taskId?: string;
  @ApiPropertyOptional()
  currentField?: TaskFieldDto;
}

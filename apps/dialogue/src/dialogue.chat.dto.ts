import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import {
  DialogueTaskDto,
  TaskFieldDto,
} from './tasks/store/dialogue.tasks.store.dto';
import { DialogueToolsRepositoryDto } from './tools/repository/dialogue.tools.repository.dto';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';

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

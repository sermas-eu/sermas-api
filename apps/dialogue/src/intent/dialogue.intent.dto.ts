import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { DialogueTaskRecordDto } from '../tasks/record/dialogue.tasks.record.dto';
import {
  DialogueTaskDto,
  TaskFieldDto,
  TaskIntentDto,
} from '../tasks/store/dialogue.tasks.store.dto';
import { DialogueToolsRepositoryDto } from '../tools/repository/dialogue.tools.repository.dto';

export type TaskIntentWrapper = {
  taskId: string;
  trigger: boolean;
  match: boolean;
  cancel: boolean;
};

export type TaskIntentMatch = {
  skip: boolean;
  intent: TaskIntentWrapper;
  task: DialogueTaskDto;
  record?: DialogueTaskRecordDto;
  tasks: DialogueTaskDto[];
};

export type TaskIntentMatchResult = {
  skipResponse?: boolean;
  task?: TaskIntentResult;
  tools?: IntentActiveTools;
};

export type TaskIntentsList = {
  taskId?: string;
  description: string;
  intents: TaskIntentDto[];
};

export type TaskIntents = {
  tasks: DialogueTaskDto[];
  intents: TaskIntentsList[];
};

export type TaskIntentResult = {
  cancelledTaskId?: string;
  selectedTask?: DialogueTaskDto;
  currentTask?: DialogueTaskDto;
  currentField?: TaskFieldDto;
  suggestedTasks: DialogueTaskDto[];
  skipResponse?: boolean;
};

export type ActiveTaskRecord = {
  record: DialogueTaskRecordDto;
  task: DialogueTaskDto;
};

export type IntentActiveTools = {
  tools: AppToolsDTO[];
  repositories: DialogueToolsRepositoryDto[];
  isToolExclusive: boolean;
  matchOrRemoveTask: boolean;
  hasCatchAll: AppToolsDTO;
};

import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { DialogueTaskRecordDto } from '../tasks/record/dialogue.tasks.record.dto';
import {
  DialogueTaskDto,
  TaskFieldDto,
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

export type PrompIntent = {
  taskId?: string;
  taskDescription: string;
  description: string;
  name: string;
};

export type TaskIntents = { tasks: DialogueTaskDto[]; intents: PrompIntent[] };

export type TaskIntentResult = {
  cancelledTaskId?: string;
  selectedTask?: DialogueTaskDto;
  currentTask?: DialogueTaskDto;
  currentField?: TaskFieldDto;
  availableTasks: DialogueTaskDto[];
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

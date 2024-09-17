import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericPropertyOptional } from 'libs/decorator/openapi.decorator';
import { DialogueToolsRepositoryOptionsDto } from '../../tools/repository/dialogue.tools.repository.dto';

export const TaskFieldDataTypeList = [
  'text',
  'boolean',
  'date',
  'select',
  'eval',
  'external',
] as const;

export type TaskFieldDataType = (typeof TaskFieldDataTypeList)[number];

export class OptionSelection {
  @ApiProperty({
    description: 'Selection value',
  })
  value: string;

  @ApiPropertyOptional({
    description: 'Selection label (value is used if not provided)',
  })
  label?: string;

  @ApiPropertyOptional({
    description: 'Description for an option',
  })
  description?: string;
}

export class TaskIntentDto {
  @ApiProperty({
    description: 'Intent name used as identifier',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Intent description used to match with user input',
  })
  description?: string;
}

export class TaskFieldDto {
  @ApiProperty({
    description: 'Name of the field',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Label of the field',
  })
  label?: string;

  @ApiPropertyOptional({
    description:
      'Provide context to be injected in the LLM prompt to improve handling user interactions',
  })
  hint?: string;

  @ApiPropertyOptional({
    description: 'Priority order (lower first)',
  })
  order?: number;

  @ApiProperty({
    description: 'Data type',
    enumName: 'TaskSchemaDataType',
    enum: TaskFieldDataTypeList,
  })
  type: TaskFieldDataType;

  @ApiPropertyOptional({
    description: 'Indicate if the field is required',
    default: false,
  })
  required?: boolean;

  @ApiPropertyOptional({
    description: 'A prompt to validate and transform the input',
  })
  validation?: string;

  @ApiPropertyOptional({
    description:
      'Provde an activation condition based on the stored record list. If omitted, the field is always proposed to the user.',
  })
  condition?: string;

  @ApiPropertyOptional({
    description:
      'Provde a prompt for type=evaluate based on the available record fields. Placeholders such as {field-name} are replaced with the value of the field.',
  })
  prompt?: string;

  @ApiPropertyOptional({
    description:
      'Provde an handler for type=external to delegate the field handling to an external service',
  })
  handler?: string;

  @ApiPropertyOptional({
    description: 'Allow to select multiple options',
  })
  multiple?: boolean;

  @ApiPropertyOptional({
    description: 'List of valid options',
    type: [OptionSelection],
  })
  options?: OptionSelection[];
}

export const TaskEventTypeList = [
  'started',
  'completed',
  'ongoing',
  'aborted',
] as const;
export type TaskEventType = (typeof TaskEventTypeList)[number];

export class TaskEventTriggerDto {
  @ApiPropertyOptional({
    description: 'Tool to trigger',
  })
  name?: string;
  @ApiGenericPropertyOptional({
    description: 'Tool values passed to the tool handlers',
  })
  values?: { [key: string]: any };
  @ApiPropertyOptional({
    description:
      'Evalute the condition based on values. {key} is replaced with its value.',
  })
  condition?: string;
}

export class TaskEventDto {
  @ApiProperty({
    enum: TaskEventTypeList,
    enumName: 'TaskEventType',
    description: 'Type of event to trigger',
  })
  type: TaskEventType;

  @ApiPropertyOptional({
    description: 'Chat message to send to the user',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Condition to trigger the event',
  })
  condition?: string;

  @ApiPropertyOptional({
    description: 'Trigger a tool',
    type: [TaskEventTriggerDto],
  })
  trigger?: TaskEventTriggerDto[];
}

export class TaskOptionsDto {
  [key: string]: any;

  @ApiPropertyOptional({
    description: 'Trigger this task once, then remove it',
  })
  triggerOnce?: boolean;

  @ApiPropertyOptional({
    description: 'Remove record on completion',
  })
  removeRecord?: boolean;

  @ApiPropertyOptional({
    description:
      'Enable this task as tool, allowing users to invoke it directly',
  })
  enableTool?: boolean;

  @ApiPropertyOptional({
    description: 'Additional tool options configuration',
  })
  toolOptions?: DialogueToolsRepositoryOptionsDto;

  @ApiPropertyOptional({
    description: 'ID of the tool repository to add the tool to',
  })
  repositoryId?: string;

  @ApiPropertyOptional({
    description: 'Show this tool to the user, such as in the welcome message',
  })
  list?: boolean;

  @ApiPropertyOptional({
    description: 'Allow this task to be completed only once per session',
  })
  oncePerSession?: boolean;

  @ApiPropertyOptional({
    description:
      'Cancel the task if the user answer does not match one of the task options',
  })
  matchOrRemove?: boolean;
}

export class DialogueTaskDto {
  @ApiProperty({
    description: 'Task ID',
  })
  taskId: string;

  @ApiProperty({
    description: 'Application ID references',
  })
  appId: string;

  @ApiPropertyOptional({
    description:
      'Provide context to be injected in the LLM prompt to improve handling user interactions',
  })
  hint?: string;

  @ApiPropertyOptional({
    description: 'Session ID references',
  })
  sessionId?: string;

  @ApiProperty({
    description: 'Task name',
  })
  name: string;

  @ApiProperty({
    description: 'Task label',
  })
  label?: string;

  @ApiPropertyOptional({
    description: 'Task description',
  })
  description?: string;

  @ApiPropertyOptional({
    description:
      'A list of intents to evaluate when the user interacts with the agent',
    type: [TaskIntentDto],
  })
  intents?: TaskIntentDto[];

  @ApiPropertyOptional({
    description: 'Map task events',
    type: [TaskEventDto],
  })
  events?: TaskEventDto[];

  @ApiProperty({
    description: 'Task fields',
    type: [TaskFieldDto],
  })
  fields: TaskFieldDto[];

  @ApiPropertyOptional({
    description: 'Task options',
    type: TaskOptionsDto,
  })
  options?: TaskOptionsDto;
}

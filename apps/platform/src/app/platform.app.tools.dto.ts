import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LLMTool,
  ToolParam,
  ToolParamType,
  ToolRequestConfig,
  ToolSchemaTypeList,
} from '#apps/dialogue/src/chat/dialogue.chat.tools.dto';

export class AppPromptDto {
  @ApiProperty()
  text: string;
}
export class ToolsParameterSchema implements ToolParam {
  @ApiProperty({
    description: 'function parameter name',
  })
  parameter: string;
  @ApiProperty({
    description: `parameter type (one of ${ToolSchemaTypeList.join(',')})`,
    enum: ToolSchemaTypeList,
    enumName: 'ToolsParameterSchemaTypes',
  })
  type: ToolParamType;
  @ApiProperty({
    description:
      'description for the parameter, useful to give an hint while matching from the user input',
  })
  description: string;
  @ApiPropertyOptional({
    description: 'flag as required',
  })
  @ApiPropertyOptional({
    description:
      'Skip this parameter when composing the tools signature. Useful in conjunciton with `value` field to set defaults',
  })
  ignore?: boolean;
  @ApiPropertyOptional({
    description:
      'provide a predefined value, useful to fill data otherwise missing from the context',
    anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
  })
  value?: string | number | boolean | object;
}

export class ToolsRequestSchemaAuthBearer {
  @ApiPropertyOptional({
    description: 'Supported options are "client_credentials" or "password".',
  })
  clientType?: 'client_credentials' | 'password';
  @ApiPropertyOptional({
    description: 'Required for client type "client_credentials"',
  })
  clientId?: string;
  @ApiPropertyOptional({
    description: 'Required for client type "client_credentials"',
  })
  clientSecret?: string;
  @ApiPropertyOptional({
    description: 'Required for client type "password"',
  })
  username?: string;
  @ApiPropertyOptional({
    description: 'Required for client type "password"',
  })
  password?: string;
  @ApiPropertyOptional()
  audience?: string;
  @ApiProperty()
  tokenUrl: string;
  @ApiPropertyOptional()
  refreshUrl?: string;
}

export class ToolsRequestSchemaAuthBasic {
  @ApiPropertyOptional()
  username: string;
  @ApiProperty()
  password: string;
}

export class ToolsRequestSchema implements ToolRequestConfig {
  @ApiPropertyOptional({
    description:
      'Supported options are basic, bearer and module. Defaults to module if not specified.',
  })
  auth: 'basic' | 'bearer' | 'module';
  @ApiPropertyOptional({
    description: 'Used for "basic" auth type',
  })
  basic?: ToolsRequestSchemaAuthBasic;
  @ApiPropertyOptional({
    description: 'Used for "bearer" auth type',
  })
  bearer?: ToolsRequestSchemaAuthBearer;
  @ApiProperty({
    description:
      'Reference to one of the modules (or clients) available in the app',
  })
  moduleId: string;
  @ApiProperty({
    description:
      'Url to call with a JSON POST. Leave empty to skip API calling',
  })
  url?: string;
  @ApiPropertyOptional()
  headers?: Record<string, any>;
}

/**
 * UI content a tool shows when it matches: `contentType` and `content` as in a UI
 * content message (e.g. `image` with `{ src, alt }`, `quiz`, `link`, `video`).
 * Kept as plain fields here: importing the UI DTOs would cycle (see D-23).
 */
export class ToolUIContentDto {
  @ApiProperty({
    description:
      'A UI content type: image, video, link, quiz, buttons, html, webpage, pdf, …',
  })
  contentType: string;
  @ApiProperty({
    description: 'The content for that type, e.g. `{ src, alt }` for an image',
  })
  content: Record<string, any>;
  @ApiPropertyOptional()
  description?: string;
  @ApiPropertyOptional({ description: 'UI content options' })
  options?: Record<string, any>;
}

export class AppToolsDTO implements LLMTool {
  @ApiProperty({
    description:
      'Tool name used in the LLM, a descriptive name may help in identifying it correctly',
  })
  name: string;
  @ApiProperty({
    description:
      'Tool description used in the LLM, this is key to correctly match the user intent',
  })
  description: string;
  @ApiPropertyOptional({
    description: 'List of parameters of the tool',
    type: [ToolsParameterSchema],
  })
  schema?: ToolsParameterSchema[];
  @ApiPropertyOptional({
    description: 'Provide details to trigger an HTTP API call on tool match',
  })
  request?: ToolsRequestSchema;
  @ApiPropertyOptional({
    description:
      'UI content shown in the client when the tool matches (an image, a quiz, a link…)',
    type: ToolUIContentDto,
  })
  ui?: ToolUIContentDto;
  @ApiPropertyOptional({
    description: '',
  })
  returnDirect?: boolean;
  @ApiPropertyOptional({
    description: 'Ignore the LLM response when the tool matches',
  })
  skipResponse?: boolean;
  @ApiPropertyOptional({
    description:
      'API url to call on tool match, defaults to unauthenticated POST if no `request` are provided.',
  })
  url?: string;
}

/**
 * LLM per task, as `provider/model`. An unset task falls back to
 * LLM_SERVICE_<TASK>, then to the default model.
 */
export class LLMSettingsDto {
  @ApiPropertyOptional()
  chat?: string;
  @ApiPropertyOptional()
  tools?: string;
  @ApiPropertyOptional()
  sentiment?: string;
  @ApiPropertyOptional()
  tasks?: string;
  @ApiPropertyOptional()
  intent?: string;
  @ApiPropertyOptional()
  translation?: string;
}

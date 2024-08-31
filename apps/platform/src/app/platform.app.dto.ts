import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { RagWebsiteDto } from 'apps/dialogue/src/document/dialogue.document.dto';
import { DialogueTaskDto } from 'apps/dialogue/src/tasks/store/dialogue.tasks.store.dto';
import { KeycloakUser } from 'apps/keycloak/src/keycloak.admin.dto';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  Contains,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  LLMTool,
  ToolParam,
  ToolParamType,
  ToolRequestConfig,
  ToolSchemaTypeList,
} from 'libs/llm/tools/tool.dto';
import { SermasRecordChangedDto } from 'libs/sermas/sermas.dto';
import * as sanitizeHtml from 'sanitize-html';
import { PlatformModuleConfigDto } from '../mod/mod.dto';

export const RepositoryAssetList = [
  'avatars',
  'backgrounds',
  'robots',
  'documents',
  'animations',
] as const;

export type RepositoryAssetTypes = (typeof RepositoryAssetList)[number];

export class AppUserDto extends KeycloakUser {
  @ApiPropertyOptional()
  appId?: string;
}

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
    description: 'Internal event emitted on match',
  })
  emitter?: string;
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

export const InteractionStartList = [
  'on-load',
  'touch',
  'speak',
  'intent-detection',
] as const;

export type InteractionStartTypes = (typeof RepositoryAssetList)[number];

export class LLMSettingsDto {
  chat: string;
  tools: string;
  sentiment: string;
  tasks: string;
  intent: string;
  translation: string;
}

export class AppSettingsDto implements Record<string, any> {
  @ApiPropertyOptional({
    description: 'Skip the default tools response as generated by the LLM',
  })
  skipToolResponse?: boolean;
  @ApiPropertyOptional({
    description: 'Toggle text to speech (TTS) rendering',
  })
  ttsEnabled?: boolean;
  @ApiPropertyOptional({
    description: 'App requires login',
  })
  login?: boolean;
  @ApiProperty({
    description: 'Avatar ID',
  })
  avatar: string;
  @ApiPropertyOptional({
    description: 'Default interaction language such as en-GB ',
  })
  language?: string;
  @ApiPropertyOptional({
    description: 'LLM models settings',
  })
  llm?: LLMSettingsDto;
  @ApiProperty({
    description: 'Kisok background image ID',
  })
  background: string;
  @ApiPropertyOptional({
    description: 'Application prompt to describe the scope of the application',
  })
  prompt?: AppPromptDto;
  @ApiPropertyOptional({
    description: 'Toggle the welcome message sent at the start of a session',
  })
  skipWelcomeMessage?: boolean;
  @ApiPropertyOptional({
    enum: InteractionStartList,
    enumName: 'InteractionStartTypes',
    description: 'An interaction modality to start a session',
  })
  interactionStart?: InteractionStartTypes;
  @ApiPropertyOptional({
    type: Object,
    description: 'Kiosk colors theme',
  })
  theme?: Record<string, string>;
}

export class AppClientDto {
  @IsUUID('4')
  @IsOptional()
  @ApiPropertyOptional()
  appId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  name?: string;

  @IsUUID('4')
  @IsOptional()
  @ApiPropertyOptional({
    description:
      'The clientId, must be unique in the client list and in uuid format.',
  })
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  secret?: string;

  @IsArray()
  @IsOptional()
  @MinLength(1, {
    each: true,
  })
  @Contains('.', {
    each: true,
  })
  @ApiProperty({
    description:
      'A list of permissions for this client in the form [resource].[scope] e.g. detection.intent. User *.* for all permission',
  })
  permissions: string[];
}

export class AppModuleConfigDto extends PlatformModuleConfigDto {
  @IsUUID('4')
  @IsOptional()
  @ApiPropertyOptional()
  appId?: string;
}

export const ModelTypes = ['readyplayerme', 'custom'];
export type ModelType = (typeof ModelTypes)[number];

export const ModelGenders = ['M', 'F'];
export type ModelGender = (typeof ModelGenders)[number];

export class Point3D {
  @ApiProperty()
  x: number;
  @ApiProperty()
  y: number;
  @ApiProperty()
  z: number;
}

export class AvatarCameraConfig {
  @ApiProperty()
  position: Point3D;
  @ApiProperty()
  rotation: Point3D;
}

export class RepositoryAssetMetadataDto implements Record<string, any> {}

export class RepositoryAssetDto<T = RepositoryAssetMetadataDto>
  implements Record<string, any>
{
  @ApiProperty({ required: true })
  id: string;
  @ApiProperty({
    required: true,
    enum: RepositoryAssetList,
    enumName: 'RepositoryAssetTypes',
  })
  type: RepositoryAssetTypes;
  @ApiPropertyOptional()
  name?: string;
  @ApiProperty()
  path: string;
  @ApiPropertyOptional({
    type: RepositoryAssetMetadataDto,
  })
  metadata?: T;
}

export class AvatarTTSOptions {
  @ApiPropertyOptional()
  provider: string;
  @ApiPropertyOptional()
  model: string;
}

export class RepositoryAvatarDto extends RepositoryAssetDto {
  @ApiProperty({ enum: ModelTypes, enumName: 'ModelType' })
  modelType: ModelType;
  @ApiProperty({
    enum: ModelGenders,
    enumName: 'ModelGender',
  })
  gender: ModelGender;
  @ApiPropertyOptional()
  camera?: AvatarCameraConfig;
  @ApiPropertyOptional()
  cameraMobile?: AvatarCameraConfig;
  @ApiPropertyOptional()
  prompt?: string;
  @ApiPropertyOptional()
  tts?: AvatarTTSOptions;
}

export class RobotMapDto implements Record<string, any> {
  @ApiPropertyOptional()
  imageUrl?: string;
  @ApiPropertyOptional()
  width?: number;
  @ApiPropertyOptional()
  height?: number;
  @ApiPropertyOptional()
  originOffsetX?: number;
  @ApiPropertyOptional()
  originOffsetY?: number;
}

export class RepositoryRobotModelDto extends RepositoryAssetDto {
  @ApiProperty()
  videoUrl: string;
  @ApiPropertyOptional()
  map?: RobotMapDto;
}

export class RepositoryBackgroundMetadataDto extends RepositoryAssetMetadataDto {
  @ApiPropertyOptional()
  credits?: string;
}

export class RepositoryBackgroundDto extends RepositoryAssetDto<RepositoryBackgroundMetadataDto> {
  @ApiPropertyOptional({
    type: RepositoryBackgroundMetadataDto,
  })
  metadata?: RepositoryBackgroundMetadataDto;
}

export class RepositoryDocumentDto extends RepositoryAssetDto {}
export class RepositoryAnimationDto extends RepositoryAssetDto {}

export class RepositoryConfigDto implements Record<RepositoryAssetTypes, any> {
  @ApiProperty({
    type: [RepositoryAvatarDto],
  })
  avatars: RepositoryAvatarDto[];
  @ApiProperty({
    type: [RepositoryBackgroundDto],
  })
  backgrounds: RepositoryBackgroundDto[];
  @ApiPropertyOptional({
    type: [RepositoryRobotModelDto],
  })
  robots: RepositoryRobotModelDto[];
  @ApiPropertyOptional({
    type: [RepositoryDocumentDto],
  })
  documents: RepositoryDocumentDto[];
  @ApiPropertyOptional({
    type: [RepositoryAnimationDto],
  })
  animations: RepositoryAnimationDto[];
}

export class RagDocumentsDto {
  websites: [RagWebsiteDto];
}

export class PlatformAppDto {
  // @IsUUID('4')
  @ApiProperty()
  appId: string;

  @ApiPropertyOptional()
  @IsOptional()
  public?: boolean;

  @IsString()
  @Transform((params: TransformFnParams) => sanitizeHtml(params.value))
  @ApiProperty()
  name: string;

  @IsString()
  @IsOptional()
  @Transform((params: TransformFnParams) => sanitizeHtml(params.value))
  @ApiProperty()
  description?: string;

  // @IsUUID('4')
  @ApiProperty({
    description: 'Owner of the application',
  })
  ownerId: string;

  @IsArray()
  @ValidateNested()
  @ApiProperty({
    type: [AppModuleConfigDto],
  })
  modules: AppModuleConfigDto[];

  @ApiProperty()
  repository: RepositoryConfigDto;

  @ValidateNested()
  @ApiProperty({
    type: [AppClientDto],
  })
  clients: AppClientDto[];

  @IsOptional()
  @ApiPropertyOptional()
  settings?: AppSettingsDto;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional()
  createdAt?: Date;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional()
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: 'Application tools offered by the application',
    type: [AppToolsDTO],
  })
  @IsOptional()
  tools: AppToolsDTO[];

  @ApiPropertyOptional({
    description: 'Structured tasks offered by the application',
    type: [DialogueTaskDto],
  })
  @IsOptional()
  tasks: DialogueTaskDto[];

  @IsOptional()
  @ApiPropertyOptional({
    description: 'List of RAG documents or urls to import',
    type: RagDocumentsDto,
  })
  rag?: RagDocumentsDto;
}

export class CreatePlatformAppDto extends OmitType(PlatformAppDto, [
  'appId',
  'createdAt',
  'updatedAt',
] as const) {}

export class PlatformAppChangedDto extends SermasRecordChangedDto<PlatformAppDto> {
  @ApiProperty()
  record: PlatformAppDto;
}

export class PlatformAppClientChangedDto extends SermasRecordChangedDto<AppClientDto> {
  @ApiProperty()
  record: AppClientDto;
}

export class PlatformAppExportFilterDto {
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional()
  appId?: string[];
}

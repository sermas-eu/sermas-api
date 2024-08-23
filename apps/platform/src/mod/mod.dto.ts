import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { PlatformTopic } from '../topics/platform.topics.dto';

export class ModuleResourceDto extends PlatformTopic {
  @ApiProperty({
    description: 'Resource of the module operation',
  })
  resource: string;

  @ApiProperty({
    description: 'Scope of the module operation',
  })
  scope: string;

  @ApiPropertyOptional({
    description:
      'Additional context, added to the request and event topic when triggered. Can contain variable substituted from the  payload, such as :appId',
  })
  context?: string[];

  @ApiPropertyOptional({
    description: 'Name of the module operation',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the module operation',
  })
  description?: string;

  @ApiProperty({
    description: 'Unique identifier of the module',
  })
  moduleId: string;

  @ApiProperty({
    description: 'Operation to call from the module OpenAPI spec',
  })
  operationId?: string;

  @ApiPropertyOptional({
    description:
      'Indicate if an event should be emitted when this module resource is triggered. The format is app/:appId/<resource>/<scope>/[...context]',
  })
  emitEvent?: boolean;
}

export class ModuleSettingsDto {
  [setting: string]: any;

  @ApiPropertyOptional({
    description: 'Service URL used to load .well-known',
  })
  url?: string;

  @ApiProperty({
    description:
      'Reference to a openapi specification to use to map requests to the modules',
  })
  openapiSpec?: string;

  @ApiProperty({
    description:
      'Reference to a asyncAPI specification to use to map requests to the modules',
  })
  asyncapiSpec?: string;

  @ApiProperty({
    description: 'List of managed resources and scopes for this module',
    type: [ModuleResourceDto],
  })
  resources: ModuleResourceDto[];
}

export class PlatformModuleConfigDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  moduleId: string;

  @ApiPropertyOptional({
    description:
      'Status of the module. `enabled` by default. can be `disabled`. Set to `failure` if loading generates errors.',
  })
  status?: 'enabled' | 'disabled' | 'failure';

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  supports: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty()
  config?: ModuleSettingsDto;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  secret?: string;
}

export class ModuleConfigEventDto {
  @ApiProperty()
  operation: SermasRecordChangedOperation;

  @ApiProperty()
  ts: Date;

  @ApiProperty()
  record: PlatformModuleConfigDto;
}

export class ModuleProxyRequestDto {
  moduleId: string;
  operationId: string;
  qs?: Record<string, any>;
  params?: Record<string, any>;
  body?: Record<string, any>;
}

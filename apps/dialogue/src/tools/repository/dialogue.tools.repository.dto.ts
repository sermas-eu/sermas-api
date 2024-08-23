import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export class DialogueToolsRepositoryOptionsDto {
  [key: string]: any;
  @ApiPropertyOptional({
    description:
      'Trigger one of the tools in the list once, then remove the tools.',
  })
  triggerOnce?: boolean;

  @ApiPropertyOptional({
    description:
      'Alter the normal chat flow, assuming one of the available tools will provide an answer.',
  })
  exclusive?: boolean;
}

export class DialogueToolsRepositoryDto extends SermasSessionDto {
  @ApiPropertyOptional({
    description: 'Tool repository ID',
  })
  repositoryId?: string;

  @ApiPropertyOptional({
    description: 'Tool repository options',
  })
  options?: DialogueToolsRepositoryOptionsDto;

  @ApiPropertyOptional({
    description: 'Tools list',
    type: AppToolsDTO,
    isArray: true,
  })
  tools?: AppToolsDTO[];
}

export class DialogueToolsRepositoryRecordDto extends DialogueToolsRepositoryDto {
  @ApiProperty({
    description: 'Tool repository ID',
  })
  repositoryId: string;
}

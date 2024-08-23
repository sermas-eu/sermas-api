import { ApiProperty } from '@nestjs/swagger';
import { ToolsParameterSchema } from 'apps/platform/src/app/platform.app.dto';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export class DialogueToolRequestDto extends SermasSessionDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  params: ToolsParameterSchema;
}

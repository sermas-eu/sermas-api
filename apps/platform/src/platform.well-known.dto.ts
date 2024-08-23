import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SermasWellKnowDto {
  @ApiProperty()
  openapiSpec: string;

  @ApiProperty()
  asyncapiSpec: string;

  @ApiPropertyOptional()
  openapiUi?: string;

  @ApiPropertyOptional()
  asyncapiUi?: string;
}

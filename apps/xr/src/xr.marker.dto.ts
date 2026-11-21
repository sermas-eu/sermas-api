import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto, SermasRecordChangedDto } from '#libs/sermas/sermas.dto';

export class XRMarkerDto extends SermasBaseDto {
  @ApiPropertyOptional({
    description: 'ID of the marker',
  })
  @IsOptional()
  @IsString()
  markerId?: string;

  @ApiProperty({
    description: 'Payload as decoded from the marker QR code',
  })
  @IsOptional()
  @IsString()
  payload: string;

  @ApiPropertyOptional({
    description: 'A list of tags for the marker',
  })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class XRMarkerListRequestDto {
  @ApiProperty({
    required: true,
  })
  @IsOptional()
  @IsString()
  appId: string;

  @ApiPropertyOptional({
    description: 'List of marker ID to search for',
  })
  @IsOptional()
  @IsArray()
  markerId?: string[];

  @ApiPropertyOptional({
    description: 'List of uri to search for',
  })
  @IsOptional()
  @IsArray()
  payload?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class XRMarkerChangedDto extends SermasRecordChangedDto<XRMarkerDto> {
  @ApiProperty()
  record: XRMarkerDto;
}

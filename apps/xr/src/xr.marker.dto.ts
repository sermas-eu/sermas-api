import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto, SermasRecordChangedDto } from 'libs/sermas/sermas.dto';

export class XRMarkerDto extends SermasBaseDto {
  @ApiPropertyOptional({
    description: 'ID of the marker',
  })
  markerId?: string;

  @ApiProperty({
    description: 'Payload as decoded from the marker QR code',
  })
  payload: string;

  @ApiPropertyOptional({
    description: 'A list of tags for the marker',
  })
  tags?: string[];
}

export class XRMarkerListRequestDto {
  @ApiProperty({
    required: true,
  })
  appId: string;

  @ApiPropertyOptional({
    description: 'List of marker ID to search for',
  })
  markerId?: string[];

  @ApiPropertyOptional({
    description: 'List of uri to search for',
  })
  payload?: string[];

  @ApiPropertyOptional()
  tags?: string[];
}

export class XRMarkerChangedDto extends SermasRecordChangedDto<XRMarkerDto> {
  @ApiProperty()
  record: XRMarkerDto;
}

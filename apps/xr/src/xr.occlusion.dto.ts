import { ApiProperty } from '@nestjs/swagger';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';

export class XROcclusionDto extends SermasBaseDto {
  @ApiProperty()
  occlusion: boolean;
}

export class XROcclusionRequestDto extends SermasBaseDto {
  @ApiProperty()
  assetId: string;
}

export class XROcclusionResponseDto extends XROcclusionDto {}

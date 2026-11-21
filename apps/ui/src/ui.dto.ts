import { Allow, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SermasSessionDto } from '#libs/sermas/sermas.dto';

export class UIInteractionDTO {
  @ApiProperty({
    type: Object,
  })
  @Allow()
  context: Record<string, any>;
  @ApiProperty()
  @IsOptional()
  @IsString()
  element: string;
  @ApiProperty()
  @Allow()
  value: string;
}

export class UIInteractionEventDto extends SermasSessionDto {
  @ApiProperty()
  moduleId: string;
  @ApiProperty({ type: UIInteractionDTO })
  interaction: UIInteractionDTO;
}

export class QrCodePayloadDto {
  @ApiProperty({ default: 4 })
  @IsOptional()
  @IsNumber()
  version: number;
  @ApiProperty()
  @IsOptional()
  @IsString()
  data: string;
}

export class QrCodeDto {
  @ApiProperty()
  imageDataUrl: string;
}

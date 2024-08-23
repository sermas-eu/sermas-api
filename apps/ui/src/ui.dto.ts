import { ApiProperty } from '@nestjs/swagger';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export class UIInteractionDTO {
  @ApiProperty({
    type: Object,
  })
  context: Record<string, any>;
  @ApiProperty()
  element: string;
  @ApiProperty()
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
  version: number;
  @ApiProperty()
  data: string;
}

export class QrCodeDto {
  @ApiProperty()
  imageDataUrl: string;
}

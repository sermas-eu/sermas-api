import { ApiProperty } from '@nestjs/swagger';
import { ButtonDto } from './ui.content.dto';
import { UIInteractionDTO } from './ui.dto';

export class UiInteractionButtonDto extends UIInteractionDTO {
  @ApiProperty({
    type: Object,
  })
  context: {
    [key: string]: any;
    button: ButtonDto;
  };
}

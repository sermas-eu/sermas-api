import { ApiProperty } from '@nestjs/swagger';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';

export class SessionSupportRequestDto extends SermasBaseDto {
  @ApiProperty()
  sessionId?: string;
  @ApiProperty()
  userId?: string;
  @ApiProperty()
  code?: string;
  @ApiProperty()
  message: string;
}

export class SessionSupportResponseDto extends SermasBaseDto {
  @ApiProperty()
  supportId: string;
}

export class SessionSupportEventDto extends SermasBaseDto {
  @ApiProperty()
  supportId: string;
  @ApiProperty()
  status: 'open' | 'received' | 'resolved' | 'closed';
  @ApiProperty()
  feedback?: string;
  @ApiProperty()
  code?: string;
}

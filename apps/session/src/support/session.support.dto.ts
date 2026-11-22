import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SermasBaseDto } from '#libs/sermas/sermas.dto';

export class SessionSupportRequestDto extends SermasBaseDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  sessionId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
  @ApiProperty()
  @IsOptional()
  @IsString()
  code?: string;
  @ApiProperty()
  @IsOptional()
  @IsString()
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

import { IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UIModelMapBlendShapesRequestDto {
  @ApiProperty()
  @IsOptional()
  @IsArray()
  blendShapes: string[];
}

export class UIModelMapBlendShapesResponseDto {
  @ApiProperty()
  blendShapes: Record<string, string>;
}

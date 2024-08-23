import { ApiProperty } from '@nestjs/swagger';

export class UIModelMapBlendShapesRequestDto {
  @ApiProperty()
  blendShapes: string[];
}

export class UIModelMapBlendShapesResponseDto {
  @ApiProperty()
  blendShapes: Record<string, string>;
}

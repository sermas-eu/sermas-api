import { Allow, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericPropertyOptional } from '#libs/decorator/openapi.generic.decorator';

export class SearchFilter<T = any> {
  @ApiGenericPropertyOptional({
    description: 'filter query',
  })
  @Allow()
  query: T;
  @ApiPropertyOptional({
    description: 'results limit',
  })
  @IsOptional()
  @IsNumber()
  limit?: number;
  @ApiPropertyOptional({
    description: 'results to skip from beginning',
  })
  @IsOptional()
  @IsNumber()
  skip?: number;
  @ApiPropertyOptional({
    description: 'result sorting',
  })
  @Allow()
  sort: { [key: string]: 'asc' | 'desc' };
}

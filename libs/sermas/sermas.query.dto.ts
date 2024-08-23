import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiGenericPropertyOptional } from 'libs/decorator/openapi.decorator';

export class SearchFilter<T = any> {
  @ApiGenericPropertyOptional({
    description: 'filter query',
  })
  query: T;
  @ApiPropertyOptional({
    description: 'results limit',
  })
  limit?: number;
  @ApiPropertyOptional({
    description: 'results to skip from beginning',
  })
  skip?: number;
  @ApiPropertyOptional({
    description: 'result sorting',
  })
  sort: { [key: string]: 'asc' | 'desc' };
}

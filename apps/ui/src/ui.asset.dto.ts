import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RepositoryAssetDto,
  RepositoryAssetList,
  RepositoryAssetTypes,
} from 'apps/platform/src/app/platform.app.dto';
import { SermasRecordChangedDto } from 'libs/sermas/sermas.dto';

export class UIAssetDto extends RepositoryAssetDto {
  @ApiPropertyOptional()
  filename?: string;
  @ApiProperty()
  appId: string;
  @ApiProperty({
    enum: RepositoryAssetList,
    enumName: 'RepositoryAssetTypes',
  })
  type: RepositoryAssetTypes;
  @ApiPropertyOptional()
  userId?: string;
  @ApiPropertyOptional()
  ts?: Date;
}

export class UIAssetChangedDto extends SermasRecordChangedDto<UIAssetDto> {
  @ApiProperty()
  record: UIAssetDto;
}

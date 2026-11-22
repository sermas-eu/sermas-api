import { Allow, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RepositoryAssetDto,
  RepositoryAssetList,
  RepositoryAssetTypes,
} from '#apps/platform/src/app/platform.app.dto';
import { SermasRecordChangedDto } from '#libs/sermas/sermas.dto';

export class UIAssetDto extends RepositoryAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;
  @ApiProperty()
  @IsOptional()
  @IsString()
  appId: string;
  @ApiProperty({
    enum: RepositoryAssetList,
    enumName: 'RepositoryAssetTypes',
  })
  @IsOptional()
  @IsString()
  type: RepositoryAssetTypes;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
  @ApiPropertyOptional()
  @Allow()
  ts?: Date;
}

export class UIAssetChangedDto extends SermasRecordChangedDto<UIAssetDto> {
  @ApiProperty()
  record: UIAssetDto;
}

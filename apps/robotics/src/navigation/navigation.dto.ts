import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Feature, Geometry } from 'geojson';
import { PoseDto } from '../robotics.dto.js';

export class SpaceOptionsDto {
  mapType?: 'svg' | 'custom';
  svgAreaMatch?: {
    tag: string;
    match: string;
  };
}

export class AreaDto {
  @ApiProperty()
  areaId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  area: Feature<Geometry>;

  @ApiProperty()
  position: PoseDto;
}

export class NavigationSpaceDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  spaceId: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  group: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  appId: string;

  @ApiProperty()
  @IsOptional()
  @IsObject()
  origin: PoseDto;

  @ApiProperty()
  @IsOptional()
  @IsObject()
  options?: SpaceOptionsDto;

  @ApiProperty({
    description: 'Reference to a map image as background reference',
  })
  @IsOptional()
  @IsString()
  map: string;

  @ApiProperty()
  @IsOptional()
  @IsArray()
  areas: AreaDto[];
}

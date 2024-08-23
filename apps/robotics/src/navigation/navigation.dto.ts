import { ApiProperty } from '@nestjs/swagger';
import type { Feature, Geometry } from 'geojson';
import { PoseDto } from '../robotics.dto';

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
  spaceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  group: string;

  @ApiProperty()
  appId: string;

  @ApiProperty()
  origin: PoseDto;

  @ApiProperty()
  options?: SpaceOptionsDto;

  @ApiProperty({
    description: 'Reference to a map image as background reference',
  })
  map: string;

  @ApiProperty()
  areas: AreaDto[];
}

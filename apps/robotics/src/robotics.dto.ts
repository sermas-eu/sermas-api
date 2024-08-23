import { ApiProperty } from '@nestjs/swagger';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';

export class ActuationDto {
  @ApiProperty()
  payload?: any;
}

export class PositionDto {
  @ApiProperty()
  x: number;
  @ApiProperty()
  y: number;
  @ApiProperty()
  z?: number;
}

export class OrientationDto {
  @ApiProperty()
  x?: number;
  @ApiProperty()
  y?: number;
  @ApiProperty()
  z: number;
  @ApiProperty()
  w?: number;
}

export class PoseDto {
  @ApiProperty()
  position: PositionDto;
  @ApiProperty()
  orientation: OrientationDto;
}

export class MovementDto {
  @ApiProperty()
  targetPosition?: PoseDto;
  @ApiProperty()
  personId?: string;
  @ApiProperty()
  path?: PoseDto[];
}

export class InitialPoseDto {
  @ApiProperty()
  pose: PoseDto;
  @ApiProperty()
  covariance: number[];
}

export class LinearVelocityDto {
  x: number;
  y: number;
  z: number;
}

class VelocityDto {
  @ApiProperty()
  linear: LinearVelocityDto;
  @ApiProperty()
  angular?: LinearVelocityDto;
}

export class StatusDto {
  @ApiProperty()
  actualPosition?: PoseDto;
  @ApiProperty()
  velocity?: VelocityDto;
}

export class OperationalStateDto {
  @ApiProperty()
  op: 'navigate' | 'move' | 'take';
  @ApiProperty()
  state: 'started' | 'finished' | 'failed';
}

export class ActuationEventDto extends SermasBaseDto {
  @ApiProperty()
  actuations: ActuationDto[];
}

export class MovementEventDto extends SermasBaseDto {
  @ApiProperty()
  movement: MovementDto;
}

export class StatusEventDto extends SermasBaseDto {
  @ApiProperty()
  status: StatusDto;
  @ApiProperty()
  robotId?: string;
}

export class InitialPoseEventDto extends SermasBaseDto {
  @ApiProperty()
  initialPose: InitialPoseDto;
}

export class OperationalStateEventDto extends SermasBaseDto {
  @ApiProperty()
  state: OperationalStateDto;
}

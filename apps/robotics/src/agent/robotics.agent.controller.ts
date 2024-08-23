import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { SermasBaseDto } from 'libs/sermas/sermas.dto';
import {
  ActuationEventDto,
  MovementEventDto,
  StatusEventDto,
} from '../robotics.dto';
import { OPENAPI_AGENT_TAG } from './constants';
import { RoboticsAgentService } from './robotics.agent.service';

@ApiBearerAuth()
@Controller('robotics/agent')
@ApiTags('ROBOTICS', OPENAPI_AGENT_TAG)
@ApiResource('robotics')
export class RoboticsAgentController {
  constructor(private readonly agent: RoboticsAgentService) {}

  @Post('move/:appId/:room')
  @ApiScopes('move')
  @ApiOperation({
    summary:
      'move the robot to a specified coordinates. Based on the parameter coordinates, move the robot to that coordinates.',
  })
  moveToArea(@Param('appId') appId: string, @Param('room') room: string) {
    return this.agent.moveToArea(appId, room);
  }

  @Post('status/:appId/:robotId')
  @ApiScopes('status')
  @ApiOperation({
    summary: 'get the status of the robot',
  })
  @ApiOkResponse()
  statusDescription(
    @Param('appId') appId: string,
    @Param('robotId') robotId?: string,
  ) {
    return this.agent.statusDescription(appId, robotId);
  }

  @Post('relocate')
  @ApiScopes('move')
  @ApiOperation({
    summary: 'relocate the robot',
  })
  @ApiOkResponse()
  move(@Body() payload: MovementEventDto) {
    return this.agent.move(payload);
  }

  @Post('initialpose')
  @ApiScopes('status')
  @ApiOperation({
    summary: 'set initial pose of the robot',
  })
  @ApiOkResponse()
  initialPose(@Body() payload: SermasBaseDto) {
    return this.agent.initialPose(payload.appId, payload.clientId);
  }

  @Post('actuate')
  @ApiScopes('actuate')
  @ApiOperation({
    summary: 'execute an action on the robot',
  })
  @ApiOkResponse()
  actuate(@Body() payload: ActuationEventDto) {
    return this.agent.actuate(payload);
  }
  @Post('status')
  @ApiScopes('status')
  @ApiOperation({
    summary: 'get the status of the robot',
  })
  @ApiOkResponse()
  status(@Body() payload: StatusEventDto) {
    return this.agent.status(payload);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { DialogueTasksHandlerService } from './dialogue.tasks.handler.service';
import { DialogueTaskRecordDto } from './record/dialogue.tasks.record.dto';

@ApiBearerAuth()
@Controller('dialogue/tasks')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
export class DialogueTaskController {
  constructor(private readonly taskHandler: DialogueTasksHandlerService) {}

  @Post('next-step')
  @ApiScopes('task')
  @ApiOkResponse()
  @ApiOperationName({
    description: 'Set the tools, overriding existing ones',
  })
  @ApiBody({
    type: DialogueTaskRecordDto,
  })
  nextStep(@Body() record: DialogueTaskRecordDto) {
    return this.taskHandler.updateRecord(record);
  }
}

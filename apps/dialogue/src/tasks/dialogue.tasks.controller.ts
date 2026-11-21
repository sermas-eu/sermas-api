import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { DialogueTasksHandlerService } from './dialogue.tasks.handler.service.js';
import { DialogueTaskRecordDto } from './record/dialogue.tasks.record.dto.js';

@ApiBearerAuth()
@Controller('dialogue/tasks')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
export class DialogueTaskController {
  constructor(
    private readonly taskHandler: DialogueTasksHandlerService,
    private readonly auth: PlatformAuthService,
  ) {}

  @Post('next-step')
  @ApiScopes('task')
  @ApiOkResponse()
  @ApiOperationName({
    description: 'Set the tools, overriding existing ones',
  })
  @ApiBody({
    type: DialogueTaskRecordDto,
  })
  async nextStep(
    @Body() record: DialogueTaskRecordDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    // the guard bound the session to an app the caller may use; the task must
    // be one of that app's
    const appId = await this.auth.getSessionAppId(record?.sessionId);
    if (!appId) throw new NotFoundException('session not found');
    await this.auth.assertAppAccess(user, appId);
    return this.taskHandler.updateRecord({ ...record, appId });
  }
}

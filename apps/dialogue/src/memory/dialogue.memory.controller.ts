import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { DialogueMemoryMessageDto } from './dialogue.memory.dto';
import { DialogueMemoryService } from './dialogue.memory.service';

@ApiBearerAuth()
@Controller('dialogue/memory')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
export class DialogueMemoryController {
  constructor(private readonly memory: DialogueMemoryService) {}

  @Get(':sessionId')
  @ApiScopes('speech')
  @ApiOkResponse({
    type: [DialogueMemoryMessageDto],
  })
  @ApiBadRequestResponse()
  @ApiOperationName({
    description: 'Get a session chat history',
  })
  getChatHistory(@Param('sessionId') sessionId: string) {
    return this.memory.getMessages(sessionId);
  }
}

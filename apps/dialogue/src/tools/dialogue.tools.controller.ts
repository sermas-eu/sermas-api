import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { DialogueToolsService } from './dialogue.tools.service';
import { DialogueToolsRepositoryDto } from './repository/dialogue.tools.repository.dto';

@ApiBearerAuth()
@Controller('dialogue/tools')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
@ApiExtraModels(AppToolsDTO)
export class DialogueToolsController {
  constructor(private readonly tools: DialogueToolsService) {}

  @Post(':repositoryId')
  @ApiScopes('tool')
  @ApiOkResponse()
  @ApiOperationName({
    description: 'Save tools, overwriting existing ones.',
  })
  @ApiBody({
    type: DialogueToolsRepositoryDto,
  })
  setTools(
    @Param('repositoryId') repositoryId: string,
    @Body() repository: DialogueToolsRepositoryDto,
  ) {
    if (repositoryId !== repository.repositoryId)
      throw new BadRequestException(
        `repositoryId mismatch between query and payload`,
      );
    return this.tools.set({
      ...repository,
      repositoryId,
    });
  }

  @Put(':repositoryId')
  @ApiScopes('tool')
  @ApiOkResponse()
  @ApiOperationName({
    description:
      'Add tools to the session. Existing with the same name will be overridden.',
  })
  @ApiBody({
    type: DialogueToolsRepositoryDto,
  })
  addTools(
    @Param('repositoryId') repositoryId: string,
    @Body() repository: DialogueToolsRepositoryDto,
  ) {
    if (repositoryId !== repository.repositoryId)
      throw new BadRequestException(
        `repositoryId mismatch between query and payload`,
      );
    return this.tools.add({
      ...repository,
      repositoryId,
    });
  }

  @Delete(':repositoryId')
  @ApiScopes('tool')
  @ApiOkResponse()
  @ApiOperationName({
    description: 'Remove a set of tools',
  })
  removeRepository(@Param('repositoryId') repositoryId: string) {
    return this.tools.delete(repositoryId);
  }
}

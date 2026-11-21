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
import { AppToolsDTO } from '#apps/platform/src/app/platform.app.dto';
import { PlatformAuthService } from '#apps/platform/src/auth/platform.auth.service';
import type { AuthJwtUser } from '#apps/auth/src/auth.dto';
import { AuthenticatedUser } from '#libs/auth/auth.decorators';
import { ApiResource, ApiScopes } from '#libs/decorator/openapi.decorator';
import { ApiOperationName } from '#libs/decorator/openapi.operation.decorator';
import { DialogueToolsService } from './dialogue.tools.service.js';
import { DialogueToolsRepositoryDto } from './repository/dialogue.tools.repository.dto.js';

@ApiBearerAuth()
@Controller('dialogue/tools')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
@ApiExtraModels(AppToolsDTO)
export class DialogueToolsController {
  constructor(
    private readonly tools: DialogueToolsService,
    private readonly auth: PlatformAuthService,
  ) {}

  /** An existing repository may only be changed by its own app. */
  private async assertRepositoryApp(repositoryId: string, user: AuthJwtUser) {
    const existing = await this.tools.get(repositoryId, false);
    if (existing) await this.auth.assertAppAccess(user, existing.appId);
  }

  @Post(':repositoryId')
  @ApiScopes('tool')
  @ApiOkResponse()
  @ApiOperationName({
    description: 'Save tools, overwriting existing ones.',
  })
  @ApiBody({
    type: DialogueToolsRepositoryDto,
  })
  async setTools(
    @Param('repositoryId') repositoryId: string,
    @Body() repository: DialogueToolsRepositoryDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    await this.auth.assertAppAccess(user, repository?.appId);
    await this.assertRepositoryApp(repositoryId, user);
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
  async addTools(
    @Param('repositoryId') repositoryId: string,
    @Body() repository: DialogueToolsRepositoryDto,
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    await this.auth.assertAppAccess(user, repository?.appId);
    await this.assertRepositoryApp(repositoryId, user);
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
  async removeRepository(
    @Param('repositoryId') repositoryId: string,
    @AuthenticatedUser() user: AuthJwtUser,
  ) {
    await this.assertRepositoryApp(repositoryId, user);
    return this.tools.delete(repositoryId);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { DeleteResult } from 'mongodb';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  DataCollectionGroupDto,
  DataCollectionSessionDto,
  GroupStats,
  SaveAttachmentResponseDto,
} from './data-collection.dto';
import { DataCollectionService } from './data-collection.service';


@ApiBearerAuth()
@Controller('data-collection')
@ApiResource('datacollection')
@ApiTags('DIALOGUE')
export class DataCollectionController {
  constructor(private readonly dataCollection: DataCollectionService) {}

  @Get(':appId/intents')
  @ApiScopes('interaction')
  intents(@Param('appId') appId: string): Promise<string[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getIntents();
  }

  @Get(':appId/slots')
  @ApiScopes('interaction')
  @ApiOperation({
    summary: 'Get slots based on intent and subject',
  })
  slots(
    @Param('appId') appId: string,
    @Query('intent') intent: string,
    @Query('subject') subject: string,
  ): Promise<string[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getSlots(intent, subject);
  }

  @Get(':appId/allslots')
  @ApiScopes('interaction')
  @ApiOperation({
    summary: 'Get all slots',
  })
  allSlots(@Param('appId') appId: string): string[] {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getAllSlots();
  }

  @Get(':appId/emotions')
  @ApiScopes('interaction')
  emotions(@Param('appId') appId: string): Promise<string[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getEmotions();
  }

  @Get(':appId/gestures')
  @ApiScopes('interaction')
  gestures(@Param('appId') appId: string): Promise<string[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getGestures();
  }

  @Get(':appId/actions')
  @ApiScopes('interaction')
  actions(@Param('appId') appId: string): Promise<string[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.getActions();
  }

  @Get(':appId/session/:groupid')
  @ApiScopes('interaction')
  @ApiParam({ name: 'groupid', required: true })
  list(
    @Param('appId') appId: string,
    @Param('groupid') groupid: string,
  ): Promise<Partial<DataCollectionSessionDto>[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.list(groupid);
  }

  @Delete(':appId/session/:id')
  @ApiParam({ name: 'id', required: true })
  @ApiScopes('interaction')
  deleteSession(
    @Param('appId') appId: string,
    @Param('id') id: string,
  ): Promise<DeleteResult> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.deleteSession(id);
  }

  @Get(':appId/session/:groupid/:id/')
  @ApiScopes('interaction')
  @ApiParam({ name: 'groupid', required: true })
  @ApiParam({ name: 'id', required: true })
  fetch(
    @Param('appId') appId: string,
    @Param('groupid') groupid: string,
    @Param('id') id: string,
  ): Promise<DataCollectionSessionDto> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.read(groupid, id);
  }

  @Post(':appId/import')
  @ApiScopes('interaction')
  import(@Param('appId') appId: string) {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.import();
  }

  @Post(':appId/import/json')
  @ApiScopes('interaction')
  importFromJson(
    @Param('appId') appId: string,
    @Body() json: DataCollectionSessionDto,
    @AuthenticatedUser()
    user?: any,
  ) {
    return this.dataCollection.importFromJson(json, user);
  }

  @Post(':appId/import/file')
  @ApiScopes('interaction')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Import from JSON file',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importFromFile(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File,
    @AuthenticatedUser()
    user?: any,
  ) {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.importFromFile(file, user);
  }

  @Post(':appId/session')
  @ApiScopes('interaction')
  save(
    @Param('appId') appId: string,
    @Body() session: DataCollectionSessionDto,
    @AuthenticatedUser()
    user?: any,
  ): Promise<DataCollectionSessionDto> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.save(session, user);
  }

  @Get(':appId/group')
  @ApiScopes('interaction')
  async listGroups(
    @Param('appId') appId: string,
  ): Promise<Partial<DataCollectionGroupDto>[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.listGroups();
  }

  @Get(':appId/groups/stats')
  @ApiScopes('interaction')
  async statsGroups(@Param('appId') appId: string): Promise<GroupStats[]> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.statisticsGroups();
  }

  @Get(':appId/download/:groupid')
  @ApiParam({ name: 'groupid', required: true })
  @ApiScopes('interaction')
  async downloadGroupData(
    @Param('appId') appId: string,
    @Param('groupid') groupid: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return await this.dataCollection.downloadGroupData(groupid, res);
  }

  @Delete(':appId/group/:groupId')
  @ApiParam({ name: 'groupId', required: true })
  @ApiScopes('interaction')
  async deleteGroup(
    @Param('appId') appId: string,
    @Param('groupId') groupId,
  ): Promise<DeleteResult> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return await this.dataCollection.deleteGroup(groupId);
  }

  @Post(':appId/group')
  @ApiScopes('interaction')
  async saveGroup(
    @Param('appId') appId: string,
    @Body() group: DataCollectionGroupDto,
    @AuthenticatedUser()
    user?: any,
  ): Promise<DataCollectionGroupDto> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    return this.dataCollection.saveGroup(group, user);
  }

  @Post(':appId/attachment/:groupId')
  @ApiScopes('interaction')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Import attachment',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFile(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File,
    @Param('groupId') groupId,
  ): Promise<SaveAttachmentResponseDto> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!groupId) {
      throw new BadRequestException('Group id not found in the request');
    }
    return await this.dataCollection.saveAttachment(groupId, file);
  }

  @Get(':appId/group/:groupId/attachment/:attachmentId')
  @ApiParam({ name: 'groupId', required: true })
  @ApiParam({ name: 'attachmentId', required: true })
  @ApiScopes('interaction')
  async getFile(
    @Param('appId') appId: string,
    @Param('groupId') groupId,
    @Param('attachmentId') attachmentId,
  ): Promise<StreamableFile | string> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!groupId || !attachmentId) {
      throw new BadRequestException(
        'Group identifier or attachment identifier not found in the request',
      );
    }
    return await this.dataCollection.getAttachment(groupId, attachmentId);
  }

  @Delete(':appId/group/:groupId/attachment/:attachmentId')
  @ApiParam({ name: 'groupId', required: true })
  @ApiParam({ name: 'attachmentId', required: true })
  @ApiScopes('interaction')
  async deleteFile(
    @Param('appId') appId: string,
    @Param('groupId') groupId,
    @Param('attachmentId') attachmentId,
  ): Promise<void> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!groupId || !attachmentId) {
      throw new BadRequestException(
        'Group identifier or attachment identifier not found in the request',
      );
    }
    return await this.dataCollection.deleteAttachment(groupId, attachmentId);
  }
}

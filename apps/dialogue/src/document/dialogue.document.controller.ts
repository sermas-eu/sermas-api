import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { DialogueDocumentDto, RagWebsiteDto } from './dialogue.document.dto';
import { DialogueDocumentService } from './dialogue.document.service';

@ApiBearerAuth()
@Controller('dialogue/document')
@ApiResource('dialogue')
@ApiTags('DIALOGUE')
export class DialogueDocumentController {
  constructor(private readonly document: DialogueDocumentService) {}

  @Put()
  @ApiBody({
    type: DialogueDocumentDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Saved document',
    type: DialogueDocumentDto,
  })
  @ApiScopes('document')
  @ApiOperationName()
  async save(@Body() documents: DialogueDocumentDto[]) {
    return this.document.save(documents);
  }

  @Post()
  @ApiOperationName({
    summary: 'Import RAG documents',
  })
  @ApiBody({
    description: 'Documents list',
    type: DialogueDocumentDto,
    isArray: true,
  })
  @ApiOkResponse({
    status: 200,
    type: DialogueDocumentDto,
    isArray: true,
  })
  @ApiScopes('document')
  async import(
    @Body() documents: DialogueDocumentDto[],
  ): Promise<DialogueDocumentDto[]> {
    return this.document.import(documents);
  }

  @Post('/website')
  @ApiOperationName({
    summary: 'Import RAG documents by website scraping',
  })
  @ApiBody({
    description: 'URL',
    type: RagWebsiteDto,
  })
  @ApiOkResponse({
    status: 200,
  })
  @ApiScopes('document')
  async importWebsite(@Body() website: RagWebsiteDto): Promise<void> {
    return this.document.importWebsite(website.appId, website);
  }

  @Delete(':appId/all')
  @ApiOperationName({
    summary: 'Remove all RAG documents',
  })
  @ApiOkResponse()
  @ApiScopes('document')
  removeAll(@Param('appId') appId: string): Promise<void> {
    if (!appId) throw new BadRequestException('Missing appId');
    return this.document.removeAll(appId);
  }

  @Delete(':appId')
  @ApiOperationName({
    summary: 'Remove RAG documents',
  })
  @ApiOkResponse()
  @ApiScopes('document')
  remove(
    @Param('appId') appId: string,
    @Query('documentId') documentId: string[],
  ): Promise<void> {
    if (!appId) throw new BadRequestException('Missing appId');
    if (!documentId || !documentId.length)
      throw new BadRequestException('Missing documentId');
    return this.document.remove(appId, documentId);
  }
}

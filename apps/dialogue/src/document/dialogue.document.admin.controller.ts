import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { DialogueDocumentService } from './dialogue.document.service';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';

@ApiBearerAuth()
@Controller('dialogue/admin/document')
@ApiResource('dialogue')
@ApiTags('DIALOGUE')
export class DialogueDocumentAdminController {
  constructor(private readonly document: DialogueDocumentService) {}

  @Post()
  @ApiOkResponse()
  @ApiScopes('document')
  @ApiOperationName()
  async import() {
    return this.document.loadDatasets();
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { UIAsyncApiService } from './ui.async.service';
import {
  BackgroundUIAudioDto,
  ButtonsUIContentDto,
  ClearScreenDto,
  ClearUIContentDto,
  DialogueMessageUIContentDto,
  EmailContentDto,
  EmailUIContentDto,
  HtmlUIContentDto,
  ImageUIContentDto,
  LinkUIContentDto,
  ObjectUIContentDto,
  PdfUIContentDto,
  QuizUIContentDto,
  TextUIContentDto,
  UIContentDto,
  VideoUIContentDto,
  WebpageUIContentDto,
} from './ui.content.dto';
import { QrCodeDto, QrCodePayloadDto, UIInteractionDTO } from './ui.dto';
import { UiInteractionButtonDto } from './ui.interaction.dto';
import { UIService } from './ui.service';

@ApiBearerAuth()
@Controller('ui')
@ApiResource('ui')
@ApiTags('UI')
@ApiExtraModels(
  ImageUIContentDto,
  VideoUIContentDto,
  PdfUIContentDto,
  WebpageUIContentDto,
  ObjectUIContentDto,
  TextUIContentDto,
  QuizUIContentDto,
  ClearUIContentDto,
  ClearScreenDto,
  ButtonsUIContentDto,
  DialogueMessageUIContentDto,
  LinkUIContentDto,
  HtmlUIContentDto,
  EmailUIContentDto,
  EmailContentDto,
  BackgroundUIAudioDto,
  //
  UiInteractionButtonDto,
)
export class UIController {
  constructor(
    private readonly uiService: UIService,
    private readonly asyncUiService: UIAsyncApiService,
  ) {}

  @Put('interaction/:appId/:moduleId')
  @ApiResponse({
    status: 200,
  })
  @ApiResponse({
    status: 401,
    description: 'unauthorized',
  })
  @ApiScopes('interaction')
  @ApiOperationName({
    summary: 'Trigger a UI interaction',
  })
  notifyInteraction(
    @Param('appId') appId: string,
    @Param('moduleId') moduleId: string,
    @Body() interaction: UIInteractionDTO,
  ) {
    this.uiService.interaction({
      appId,
      moduleId,
      interaction,
    });
  }

  @Put('content/:appId')
  @ApiResponse({
    status: 200,
    description: 'Content to show',
    type: UIContentDto,
  })
  @ApiResponse({
    status: 401,
    description: 'unauthorized',
  })
  @ApiScopes('content')
  @ApiOperationName({
    summary: 'Show content',
  })
  showContent(@Body() content: UIContentDto) {
    if (!content.appId) throw new BadRequestException();
    return this.uiService.showContent(content);
  }

  @Post('qrcode/generate')
  @ApiOkResponse({
    type: QrCodeDto,
  })
  @ApiScopes('content')
  @ApiOperationName({
    summary: 'Generate a QR code',
  })
  @ApiScopes('content')
  generateQrCode(@Body() data: QrCodePayloadDto): Promise<QrCodeDto> {
    return this.uiService.generateQRCode(data);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { DetectionService } from 'apps/detection/src/detection.service';
import {
  DetectionStreamerRequest,
  VideoFrame,
  VideoFrameEvent,
} from 'apps/detection/src/detection.streamer.dto';
import { DetectionStreamingService } from 'apps/detection/src/detection.streamer.service';
import { MJPEG_BOUNDARY } from 'apps/detection/src/libs/constants';
import { Response } from 'express';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import {
  ObjectDetectionRequest,
  ObjectDetectionResponse,
  SentimentAnalysisRequest,
  SentimentAnalysisResponse,
  UserInteractionIntentionDto,
} from './detection.dto';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';

@ApiBearerAuth()
@Controller('detection')
@ApiResource('detection')
@ApiTags('DETECTION')
export class DetectionController {
  private readonly logger = new Logger(DetectionController.name);

  constructor(
    private readonly detection: DetectionService,
    private readonly streamer: DetectionStreamingService,
    private readonly emitter: EventEmitter2,
  ) {}

  @Post('object-detection')
  @ApiOkResponse()
  @ApiScopes('detection')
  @ApiOperationName()
  async objectDetection(
    @Body() payload: ObjectDetectionRequest,
  ): Promise<ObjectDetectionResponse> {
    const { appId, clientId } = payload;
    const detections = await this.detection.detectObject(payload);
    return {
      clientId,
      ts: new Date(),
      appId,
      detections,
    };
  }

  @Post('sentiment-analysis')
  @ApiOkResponse()
  @ApiScopes('detection')
  async sentimentAnalysis(
    @Body() payload: SentimentAnalysisRequest,
  ): Promise<SentimentAnalysisResponse> {
    const { appId, clientId } = payload;
    const emotion = await this.detection.analiseTextSentiment(payload.text);
    return {
      clientId,
      ts: new Date(),
      appId,
      emotion,
    };
  }

  @Post('interaction')
  @ApiOkResponse()
  @ApiScopes('interaction')
  async interactionIntention(
    @Body() payload: UserInteractionIntentionDto,
  ): Promise<void> {
    await this.detection.publishInteractionIntention(payload);
  }

  @Post(':appId/:cameraId/frame')
  @ApiScopes('detection')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  sendFrame(
    @AuthenticatedUser() user: AuthJwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Param('appId') appId: string,
    @Param('cameraId') cameraId: string,
  ) {
    if (!file.buffer) throw new BadRequestException();

    const frame = file.buffer as VideoFrame;
    frame.timestamp = Date.now();
    frame.headers = {};

    this.emitter.emit('detection.streamer.frame', {
      appId,
      cameraId,
      frame,
    } as VideoFrameEvent);
  }

  @Get(':appId/:cameraId/camera')
  @ApiScopes('detection')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
  )
  @Header('Pragma', 'no-cache')
  @Header('Connection', 'close')
  @Header(
    'Content-Type',
    `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
  )
  serve(
    @Res() res: Response,
    @Param('appId') appId?: string,
    @Param('cameraId') cameraId?: string,
    @Query('overlay') overlay?: string,
  ): any {
    this.streamer.serve({
      appId,
      cameraId,
      overlay: overlay !== undefined,
      res,
    } as DetectionStreamerRequest);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import { DialogueSpeechService } from 'apps/dialogue/src/dialogue.speech.service';
import { ApiResource, ApiScopes } from 'libs/decorator/openapi.decorator';
import { ApiOperationName } from 'libs/decorator/openapi.operation.decorator';
import { ApiUpload } from 'libs/decorator/openapi.upload.decorator';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { DefaultLanguage } from 'libs/language/lang-codes';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';
import { getChunkId } from 'libs/sermas/sermas.utils';
import { DialogueSpeechToTextDto } from 'libs/stt/stt.dto';
import { DialogueTextToSpeechDto } from 'libs/tts/tts.dto';
import { uuidv4 } from 'libs/util';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';

@ApiBearerAuth()
@Controller('dialogue/speech')
@ApiTags('DIALOGUE')
@ApiResource('dialogue')
export class DialogueSpeechController {
  constructor(private readonly speech: DialogueSpeechService) {}

  @Post('tts')
  @ApiScopes('speech')
  @ApiOkResponse()
  @ApiBadRequestResponse()
  @ApiOperationName({
    description: 'Converts a text to voice as mp3',
  })
  @Header('Content-Type', 'audio/mpeg')
  @Header('Content-Disposition', `attachment; filename="speech.mp3"`)
  async speak(
    @AuthenticatedUser() user: AuthJwtUser,
    @Body() payload: DialogueTextToSpeechDto,
  ): Promise<StreamableFile> {
    if (!payload || (!payload.ssml && !payload.text)) {
      throw new BadRequestException(
        'Missing payload data (field text or ssml is required)',
      );
    }

    if (!payload.appId) throw new BadRequestException(`Missing appId`);

    payload.clientId = user.sub;
    payload.ts = new Date();

    const speech = await this.speech.textToSpeech(payload);
    return new StreamableFile(speech);
  }

  @Post('stt/:appId/:sessionId')
  @ApiScopes('speech')
  @ApiUpload(DialogueMessageDto, 'file')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  text(
    @AuthenticatedUser() user: AuthJwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: DialogueMessageDto,
    @Param('appId') appId: string,
    @Param('sessionId') sessionId: string,
    @Query('sampleRate') sampleRate?: number,
  ): Promise<void> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!sessionId) throw new BadRequestException(`Missing sessionId`);
    if (!data) throw new BadRequestException(`Missing request body`);
    if (!file.buffer)
      throw new BadRequestException(`Missing request audio buffer`);

    const ev: DialogueSpeechToTextDto = {
      ...data,

      requestId: uuidv4(),

      appId,
      sessionId,

      buffer: file.buffer,
      mimetype: file.mimetype,
      sampleRate,

      clientId: user.aud,
      userId: user.sub,

      actor: data.actor ? (data.actor === 'user' ? 'user' : 'agent') : 'user',
      // gender: data.gender === 'M' ? 'M' : 'F',
      llm: data.llm || undefined,
      avatar: data.avatar || undefined,
      language: data.language || DefaultLanguage,

      ts: data.ts ? new Date(data.ts) : new Date(),
      chunkId: data.chunkId || getChunkId(data.ts),
      ttsEnabled: data.ttsEnabled === false ? false : true,
    };

    return this.speech.speechToText(ev);
  }

  @Post('chat/:appId/:sessionId')
  @ApiScopes('speech')
  @ApiOkResponse()
  @ApiOperationName()
  chatMessage(
    @AuthenticatedUser() user: AuthJwtUser,
    @Body() data: DialogueMessageDto,
    @Param('appId') appId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!sessionId) throw new BadRequestException(`Missing sessionId`);

    if (!data.text) throw new BadRequestException(`Missing message text`);

    const dialogueMessagePayload: DialogueMessageDto = {
      ...data,

      requestId: uuidv4(),

      appId,
      sessionId,
      clientId: user.aud,
      userId: user.sub,

      actor: data.actor === 'agent' ? 'agent' : 'user',
      text: data.text,
      // gender: data.gender === 'M' ? 'M' : 'F',
      llm: data.llm || undefined,
      language: data.language || undefined,

      ts: data.ts ? new Date(data.ts) : new Date(),
      chunkId: data.chunkId || getChunkId(data.ts),
    };

    return this.speech.chat(dialogueMessagePayload);
  }

  @Post('stop/:appId/:sessionId')
  @ApiScopes('speech')
  @ApiOkResponse()
  @ApiOperationName()
  stopAgentSpeech(
    @AuthenticatedUser() user: AuthJwtUser,
    @Param('appId') appId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    if (!appId) throw new BadRequestException(`Missing appId`);
    if (!sessionId) throw new BadRequestException(`Missing sessionId`);

    const stopMessage: SermasSessionDto = {
      appId,
      sessionId,
    };
    return this.speech.stopAgentSpeech(stopMessage);
  }

  @Get('models')
  @Public()
  @ApiScopes('speech')
  @ApiOkResponse()
  @ApiOperationName()
  listModels(): Promise<string[]> {
    return this.speech.listModels();
  }
}

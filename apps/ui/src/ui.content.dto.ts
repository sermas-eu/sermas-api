import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { ApiGenericPropertyOptional } from 'libs/decorator/openapi.decorator';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { SermasSessionDto } from 'libs/sermas/sermas.dto';

export const SupportedContentTypeList = [
  'video',
  'image',
  'pdf',
  'webpage',
  'object',
  'text',
  'email',
  'html',
  'link',
  'dialogue-message',
  'navigation',
  'buttons',
  'quiz',
  'clear-screen',
  'qrcode-scanner',
] as const;

export type SupportedContentTypes = (typeof SupportedContentTypeList)[number];

export class UIContentDtoOptions implements Record<string, any> {
  @ApiProperty({
    description: 'Show content as fullscreen',
  })
  fullscreen?: boolean;
}

export class UIContentOptionsDto {
  [key: string]: any;
  @ApiPropertyOptional({
    description: 'Clear the UI screen',
  })
  clearScreen?: boolean;
  @ApiPropertyOptional({
    description: 'Enable agent reading the content (text to speech)',
  })
  ttsEnabled?: boolean;
  @ApiPropertyOptional({
    description: 'Stop the agent speech',
  })
  stopSpeech?: boolean;
  @ApiPropertyOptional({
    description:
      'Define the language of the content, it will be translated based on the language selected by the user.',
  })
  language?: string;
}

export class UIContentMetadataDto {
  [key: string]: string;
  @ApiPropertyOptional({
    description: 'Reference to a tool repository ID',
  })
  repositoryId?: string;
}

@ApiExtraModels(UIContentMetadataDto, UIContentOptionsDto)
export class UIContentDto<T = any> extends SermasSessionDto {
  @ApiProperty({
    enum: SupportedContentTypeList,
    enumName: 'SupportedContentTypes',
  })
  contentType: SupportedContentTypes;
  @ApiProperty()
  content: T;
  @ApiPropertyOptional({
    description: 'Provide a description for the content',
  })
  description?: string;
  @ApiGenericPropertyOptional({
    description: 'Provides metadata for the content',
    genericModels: [UIContentMetadataDto],
  })
  metadata?: UIContentMetadataDto;
  @ApiGenericPropertyOptional({
    description: 'Provides configuration options for the content',
    genericModels: [UIContentOptionsDto],
  })
  options?: UIContentOptionsDto;

  @ApiPropertyOptional({
    description: 'Unique sortable ID used to group and sort messages',
  })
  messageId?: string;
  @ApiPropertyOptional({
    description:
      'Unique sortable ID used to sort chunks from the same messageId',
  })
  chunkId?: string;
}

// video
export class VideoContentDto implements Record<string, any> {
  @ApiProperty()
  sources: string[];
  @ApiPropertyOptional()
  description?: string;
  @ApiPropertyOptional()
  subtitle?: string;
  @ApiPropertyOptional()
  thumb?: string;
  @ApiPropertyOptional()
  title?: string;
  @ApiPropertyOptional()
  width?: number;
  @ApiPropertyOptional()
  height?: number;
}
export class VideoUIContentDto extends UIContentDto<VideoContentDto> {
  @ApiProperty({
    type: VideoContentDto,
  })
  content: VideoContentDto;
}

// image
export class ImageContentDto {
  @ApiProperty()
  src: string;
  @ApiPropertyOptional()
  width?: number;
  @ApiPropertyOptional()
  height?: number;
  @ApiProperty()
  alt: string;
}
export class ImageUIContentDto extends UIContentDto<ImageContentDto> {
  @ApiProperty({
    type: ImageContentDto,
  })
  content: ImageContentDto;
}

// pdf
export class PdfContentDto {
  @ApiProperty()
  url: string;
}
export class PdfUIContentDto extends UIContentDto<PdfContentDto> {
  @ApiProperty({
    type: PdfContentDto,
  })
  content: PdfContentDto;
}

// webpage
export class WebpageContentDto {
  @ApiProperty()
  url: string;
}
export class WebpageUIContentDto extends UIContentDto<WebpageContentDto> {
  @ApiProperty({
    type: WebpageContentDto,
  })
  content: WebpageContentDto;
}

// object
export class ObjectContentDto {
  @ApiProperty()
  url?: string;
}
export class ObjectUIContentDto extends UIContentDto<ObjectContentDto> {
  @ApiProperty({
    type: ObjectContentDto,
  })
  content: ObjectContentDto;
}

// text
export class TextContentDto {
  @ApiProperty()
  text: string;
}
export class TextUIContentDto extends UIContentDto<TextContentDto> {
  @ApiProperty({
    type: TextContentDto,
  })
  content: TextContentDto;
}

// email
export class EmailContentDto {
  @ApiProperty()
  email: string;
  @ApiProperty()
  label?: string;
}
export class EmailUIContentDto extends UIContentDto<EmailContentDto> {
  @ApiProperty({
    type: EmailContentDto,
  })
  content: EmailContentDto;
}

// html
export class HtmlContentDto {
  @ApiProperty()
  html: string;
}
export class HtmlUIContentDto extends UIContentDto<HtmlContentDto> {
  @ApiProperty({
    type: HtmlContentDto,
  })
  content: HtmlContentDto;
}

// link
export class LinkContentDto {
  @ApiProperty()
  url: string;
  @ApiProperty()
  label?: string;
}
export class LinkUIContentDto extends UIContentDto<LinkContentDto> {
  @ApiProperty({
    type: LinkContentDto,
  })
  content: LinkContentDto;
}

// DialogueMessage
export class DialogueMessageUIContentDto extends UIContentDto<DialogueMessageDto> {
  @ApiProperty({
    type: DialogueMessageDto,
  })
  content: DialogueMessageDto;
}

export class ButtonDto {
  @ApiProperty({
    description: 'Button value',
  })
  value: string;
  @ApiPropertyOptional()
  id?: string;
  @ApiPropertyOptional({
    description: 'Button label',
  })
  label?: string;
  @ApiPropertyOptional({
    description: 'Provide a description for the button',
  })
  description?: string;
  @ApiPropertyOptional()
  classes?: string[];
  @ApiPropertyOptional()
  options?: UIContentOptionsDto;
}

// Buttons
export class ButtonsContentDto {
  @ApiProperty()
  label: string;
  @ApiProperty({
    type: [ButtonDto],
  })
  list: ButtonDto[];
}
export class ButtonsUIContentDto extends UIContentDto<ButtonsContentDto> {
  @ApiProperty({
    type: ButtonsContentDto,
  })
  content: ButtonsContentDto;
}

// Quiz
export class QuizAnswerDto {
  @ApiProperty()
  answer: string;
  @ApiProperty()
  reason: string;
  @ApiProperty()
  correct: boolean;
}
export class QuizContentDto {
  @ApiProperty()
  question: string;
  @ApiProperty({ type: [QuizAnswerDto] })
  answers: QuizAnswerDto[];
}
export class QuizUIContentDto extends UIContentDto<QuizContentDto> {
  @ApiProperty({
    type: QuizContentDto,
  })
  content: QuizContentDto;
}

// clear
export class ClearUIContentDto extends UIContentDto<void> {}

// clear screen ?
export class ClearScreenDto extends UIContentDto<void> {}
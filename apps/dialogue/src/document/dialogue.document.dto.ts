import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryAssetTypes } from 'apps/platform/src/app/platform.app.dto';

export interface RepositoryDocument {
  appId: string;
  type: RepositoryAssetTypes;
  name: string;
}

export class DialogueDocumentMetadataDto {
  [k: string]: any;
  @ApiPropertyOptional()
  uri?: string;
  @ApiPropertyOptional()
  source?: string;
}

export const DocumentParseModeList = [
  'sentence',
  'single-line',
  'double-line',
] as const;
export type DocumentParseMode = (typeof DocumentParseModeList)[number];

export class DialogueDocumentOptionsDto {
  [k: string]: any;
  @ApiPropertyOptional({
    description:
      'Define the document splitting strategy. "phrase" split by sentence, "single-line" use each line as document, "double-line" use double break-line as document',
  })
  parser?: DocumentParseMode;
}

export class DialogueDocumentDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  documentId: string;

  @ApiProperty()
  content?: string;

  @ApiProperty()
  metadata?: DialogueDocumentMetadataDto;

  @ApiProperty({
    description: 'Configure the document import handling, such as parser',
  })
  options?: DialogueDocumentOptionsDto;
}

export class RagWebsiteDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ type: [String] })
  filterPaths: string[];
}
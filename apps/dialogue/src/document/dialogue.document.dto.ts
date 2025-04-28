import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryAssetTypes } from 'apps/platform/src/app/platform.app.dto';

export interface RepositoryDocument {
  appId: string;
  type: RepositoryAssetTypes;
  name: string;
}

export class DialogueDocumentOptionsDto {
  [k: string]: any;
  @ApiPropertyOptional({
    description:
      'Define the document splitting strategy. "phrase" split by sentence, "single-line" use each line as document, "double-line" use double break-line as document',
  })
  parser?: DocumentParseMode;
  @ApiPropertyOptional({
    description:
      'If present, joins together consecutive splits as a rolling window',
  })
  parserWindowSize?: number;
}

export class DialogueDocumentMetadataDto {
  [k: string]: any;
  @ApiPropertyOptional()
  uri?: string;
  @ApiPropertyOptional()
  source?: string;
  @ApiPropertyOptional()
  filename?: string;
  @ApiPropertyOptional({
    description: 'Configure the document import handling, such as parser',
  })
  options?: DialogueDocumentOptionsDto;
}

export const DocumentParseModeList = [
  'sentence',
  'single-line',
  'double-line',
] as const;
export type DocumentParseMode = (typeof DocumentParseModeList)[number];

export class DialogueDocumentDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  documentId: string;

  @ApiProperty()
  content?: string;

  @ApiPropertyOptional()
  metadata?: DialogueDocumentMetadataDto;
}

export class RagWebsiteDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ type: [String] })
  filterPaths: string[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryAssetTypes } from '#apps/platform/src/app/platform.app.dto';

export interface RepositoryDocument {
  appId: string;
  type: RepositoryAssetTypes;
  name: string;
}

export class DialogueDocumentOptionsDto {
  [k: string]: any;
  @ApiPropertyOptional({
    description:
      'How the document is split into chunks for retrieval. "paragraph" (default): one chunk per ' +
      'paragraph (blank-line separated), long paragraphs cut into groups of sentences, a short one ' +
      'joined to the next; "sentence": one chunk per sentence; "single-line": one per line; ' +
      '"double-line": one per blank-line separated block, as is',
  })
  parser?: DocumentParseMode;
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
  'paragraph',
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

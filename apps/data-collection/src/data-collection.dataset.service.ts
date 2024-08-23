import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import {
  DataCollectionGroupDto,
  DataCollectionSessionDto,
  SaveAttachmentResponseDto,
} from './data-collection.dto';

import { OnEvent } from '@nestjs/event-emitter';
import * as path from 'path';
import { DatasetDataCollectionService } from 'libs/dataset/src/dataset.data-collection.service';

@Injectable()
export class DataCollectionDatasetService {
  constructor(
    private readonly dataset: DatasetDataCollectionService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('data-collection.attachment.delete')
  async onAttachmentDelete(groupId: string, attachmentId: string) {
    await this.deleteAttachmentRemotely(groupId, attachmentId);
  }

  @OnEvent('data-collection.attachment.save')
  async onAttachmentSave(
    file: Express.Multer.File,
    groupId: string,
    savedAttachment: SaveAttachmentResponseDto,
  ) {
    await this.saveAttachmentRemotely(file, groupId, savedAttachment);
  }

  @OnEvent('data-collection.session.save')
  async onSessionSave(session: DataCollectionSessionDto, user?: any) {
    await this.save(session, user);
  }

  @OnEvent('data-collection.group.save')
  async onGroupSave(group: DataCollectionGroupDto, user: any) {
    await this.saveGroup(group, user);
  }

  async read(groupid: string, id: string): Promise<DataCollectionSessionDto> {
    const record = await this.dataset.readSession(groupid, id);
    if (!record) throw new NotFoundException(`${id} not found`);
    return record.session;
  }

  async list(groupid: string): Promise<Partial<DataCollectionSessionDto>[]> {
    const res = await this.dataset.getSessions(groupid);
    return res.sessions;
  }

  async listGroups(): Promise<Partial<DataCollectionGroupDto>[]> {
    const list = await this.dataset.getGroups();
    return Array.from(
      list.groups.filter((g) => g !== 'main'),
      (g) => ({ groupId: g }),
    );
  }

  async save(session: DataCollectionSessionDto, user?: any) {
    if (!session.groupId) {
      throw new BadRequestException('Missing groupId');
    }
    await this.dataset.saveSession(session, user);
  }

  getGroups() {
    return this.dataset.getGroups();
  }

  getSessions(groupId: string) {
    return this.dataset.getSessions(groupId);
  }

  getAttachments(groupId: string) {
    return this.dataset.getAttachments(groupId);
  }

  async downloadGroupData(groupid: string, res: Response): Promise<void> {
    return this.dataset.downloadGroupData(groupid, res);
  }

  async saveGroup(
    group: DataCollectionGroupDto,
    user: any,
  ): Promise<DataCollectionGroupDto> {
    await this.dataset.saveGroup(group, user);
    return group;
  }

  async saveAttachmentInCache(
    groupId: string,
    file: Express.Multer.File,
  ): Promise<SaveAttachmentResponseDto> {
    const allowedExts = this.config.get('EXT_ALLOWED').split(',');
    const fileExt = path.extname(file.originalname);
    if (!fileExt) {
      throw new BadRequestException('File extension not found');
    }
    const ext = allowedExts.find((ext) => ext === fileExt);
    if (!ext) {
      throw new BadRequestException('File extension not allowed');
    }
    return await this.dataset.saveAttachmentInCache(groupId, file, ext);
  }

  async saveAttachmentContentInCache(
    groupId: string,
    buffer: Buffer,
  ): Promise<SaveAttachmentResponseDto> {
    return await this.dataset.saveAttachmentContentInCache(groupId, buffer);
  }

  async deleteAttachmentRemotely(groupId: string, attachmentId: string) {
    await this.dataset.deleteAttachmentRemotely(groupId, attachmentId);
  }

  async saveAttachmentRemotely(
    file: Express.Multer.File,
    groupId: string,
    savedAttachment: SaveAttachmentResponseDto,
  ) {
    await this.dataset.saveAttachmentRemotely(file, groupId, savedAttachment);
  }

  async getAttachment(
    groupId: string,
    attachmentId: string,
  ): Promise<StreamableFile | string> {
    return await this.dataset.getAttachment(groupId, attachmentId);
  }

  async deleteAttachment(groupId: string, attachmentId: string): Promise<void> {
    return await this.dataset.deleteAttachment(groupId, attachmentId);
  }

  async importAttachment(
    attachment: Partial<SaveAttachmentResponseDto>,
  ): Promise<void> {
    return await this.dataset.importAttachment(attachment);
  }
}

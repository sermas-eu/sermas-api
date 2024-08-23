import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import {
  DataCollectionGroupDto,
  DataCollectionSessionDto,
  GroupStats,
  SaveAttachmentResponseDto,
} from './data-collection.dto';

import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { toDTO } from 'libs/util';
import { uuidv4 } from 'libs/dataset/src';
import { DeleteResult } from 'mongodb';
import { Model } from 'mongoose';
import * as path from 'path';
import { DataCollectionDatasetService } from './data-collection.dataset.service';
import {
  DataCollectionSession,
  DataCollectionSessionDocument,
} from './data-collection.schema';
import { DialogueMessageDto } from 'libs/language/dialogue.message.dto';
import { getConfigPath } from 'libs/sermas/sermas.utils';

@Injectable()
export class DataCollectionService {
  private readonly logger = new Logger(DataCollectionService.name);

  private data;
  private slots;

  constructor(
    private readonly dataset: DataCollectionDatasetService,
    private readonly config: ConfigService,
    @InjectModel(DataCollectionSession.name)
    private readonly dataCollectionModel: Model<DataCollectionSessionDocument>,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const content = await fs.readFile(
        path.join(__dirname, `${getConfigPath()}/schemas.yaml`),
      );
      this.data = yaml.load(content.toString());
      this.slots = this.allSlots();
    } catch (e) {
      console.error(e);
    }
  }

  async getIntents(): Promise<string[]> {
    return this.data.map((item) => item.intent);
  }

  getAllSlots(): string[] {
    return this.slots;
  }

  allSlots(): string[] {
    let res = [];
    let slots = [];
    this.data.map((d) => {
      if (Array.isArray(d.required_slots)) {
        slots = d.required_slots
          .map((d) => {
            if (Array.isArray(d.possible_values) && d.possible_values.length) {
              return d.possible_values.map((v) => `${d.name}_${v}`);
            }
            return d.name;
          })
          .flat();
        res = [...res, slots];
      }

      if (Array.isArray(d.optional_slots)) {
        slots = d.optional_slots
          .map((d) => {
            if (Array.isArray(d.possible_values) && d.possible_values.length) {
              return d.possible_values.map((v) => `${d.name}_${v}`);
            }
            return d.name;
          })
          .flat();
        res = [...res, slots];
      }
      if (Array.isArray(d.result_slots)) {
        slots = d.result_slots
          .map((d) => {
            if (Array.isArray(d.possible_values) && d.possible_values.length) {
              return d.possible_values.map((v) => `${d.name}_${v}`);
            }
            return d.name;
          })
          .flat();
        res = [...res, slots];
      }

      if (Array.isArray(d.optional_result_slots)) {
        slots = d.optional_result_slots
          .map((d) => {
            if (Array.isArray(d.possible_values) && d.possible_values.length) {
              return d.possible_values.map((v) => `${d.name}_${v}`);
            }
            return d.name;
          })
          .flat();
        res = [...res, slots];
      }
    });
    return res.flat();
  }

  async getSlots(intent: string, subject: string): Promise<string[]> {
    let slots = [];
    const intentData = this.data.filter((item) => item.intent === intent);
    if (intentData.length > 0) {
      if (subject === 'user') {
        if (Array.isArray(intentData[0].required_slots))
          slots = intentData[0].required_slots
            .map((d) => {
              if (
                Array.isArray(d.possible_values) &&
                d.possible_values.length
              ) {
                return d.possible_values.map((v) => `${d.name}_${v}`);
              }
              return d.name;
            })
            .flat();
        if (Array.isArray(intentData[0].optional_slots))
          slots = [
            ...slots,
            ...intentData[0].optional_slots
              .map((d) => {
                if (
                  Array.isArray(d.possible_values) &&
                  d.possible_values.length
                ) {
                  return d.possible_values.map((v) => `${d.name}_${v}`);
                }
                return d.name;
              })
              .flat(),
          ];
      } else if (subject === 'agent') {
        if (Array.isArray(intentData[0].result_slots))
          slots = intentData[0].result_slots
            .map((d) => {
              if (Array.isArray(d.possible_values)) {
                return d.possible_values.map((v) => `${d.name}_${v}`);
              }
              return d.name;
            })
            .flat();
        if (Array.isArray(intentData[0].optional_result_slots))
          slots = [
            ...slots,
            ...intentData[0].optional_result_slots
              .map((d) => {
                if (Array.isArray(d.possible_values)) {
                  return d.possible_values.map((v) => `${d.name}_${v}`);
                }
                return d.name;
              })
              .flat(),
          ];
      }
    }
    return slots;
  }

  async getEmotions(): Promise<string[]> {
    const list = (this.config.get('DIALOGUE_EMOTIONS') || '')
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
      .sort();
    return list;
  }

  async getGestures(): Promise<string[]> {
    const list = (this.config.get('DIALOGUE_GESTURES') || '')
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
      .sort();
    return list;
  }

  async getActions(): Promise<string[]> {
    const list = (this.config.get('DIALOGUE_ACTIONS') || '')
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
      .sort();
    return list;
  }

  async import() {
    this.logger.log('Fetching groups sessions');
    const { groups } = await this.dataset.getGroups();
    const sessions = (
      await Promise.all(
        groups.map((groupId) => this.dataset.getSessions(groupId)),
      )
    )
      .map(({ sessions }) => sessions)
      .filter((sessions) => sessions.length > 0)
      .reduce((list, sessions) => [...list, ...sessions], []);

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      await this.save(session);
    }

    for (let i = 0; i < groups.length; i++) {
      const attachments = await this.dataset.getAttachments(groups[i]);
      for (let j = 0; j < attachments.length; j++) {
        await this.dataset.importAttachment(attachments[j]);
      }
    }
  }

  async read(
    groupId: string,
    sessionId: string,
  ): Promise<DataCollectionSessionDto> {
    const record = await this.dataCollectionModel.findOne({ sessionId });
    if (!record) throw new NotFoundException(`${sessionId} not found`);
    return toDTO(record);
  }

  async list(groupId: string): Promise<Partial<DataCollectionSessionDto>[]> {
    const res = await this.dataCollectionModel.find({
      groupId,
    });
    return res.map(toDTO) as DataCollectionSessionDto[];
  }

  async listGroups(): Promise<Partial<DataCollectionGroupDto>[]> {
    const list = (await this.dataCollectionModel
      .aggregate()
      .sortByCount('groupId')) as unknown as { _id: string; count: number }[];
    return list.map(({ _id }) => ({ groupId: _id }));
  }

  async statisticsGroups(): Promise<GroupStats[]> {
    let stats: GroupStats[] = [];
    const dataCollectionModels = await this.dataCollectionModel.find({});
    // console.log(JSON.stringify(dataCollectionModels, null, 6));
    let processed: string[] = [];
    for (const dataCollectionModel of dataCollectionModels) {
      if (
        processed.some((process) => process === dataCollectionModel.groupId)
      ) {
        continue;
      }
      processed = [...processed, dataCollectionModel.groupId];
      const group = dataCollectionModels.filter(
        (dataCollection) =>
          dataCollection.groupId === dataCollectionModel.groupId,
      );
      let feedbacksCount = 0;
      let dialogueCount = 0;
      let attachmentsCount = 0;
      let avgUtterancesLength = 0;

      for (const doc of group) {
        for (const utterance of doc.records) {
          dialogueCount++;
          if (utterance.attachments.length !== 0) {
            attachmentsCount++;
          }
          if (utterance.feedbacks.length !== 0) {
            feedbacksCount++;
          }
          avgUtterancesLength += utterance.text.length;
        }
      }
      stats = [
        ...stats,
        {
          groupId: dataCollectionModel.groupId,
          sessionsCount: group.length || 1,
          dialogueCount,
          attachmentsCount,
          feedbacksCount,
          avgDialoguesCount:
            Math.round((dialogueCount / group.length) * 10) / 10,
          avgUtterancesLength:
            Math.round((avgUtterancesLength / group.length) * 10) / 10,
        },
      ];
    }
    return stats;
  }

  async save(
    session: DataCollectionSessionDto,
    user?: any,
  ): Promise<DataCollectionSessionDto> {
    if (!session.groupId) {
      throw new BadRequestException('Missing groupId');
    }
    // session.groupId = session.groupId || uuidv4();
    session.authorId = user ? user.preferred_username : '';
    session.created_at = session.created_at
      ? new Date(session.created_at)
      : new Date();
    session.modified_at = new Date();
    session.sessionId = session.sessionId || uuidv4();
    session.records = session.records || [];
    session.label =
      session.label ||
      `Session ${session.created_at.toLocaleDateString('it', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: 'numeric',
      })}`;

    let record = new this.dataCollectionModel(session);
    const previous = await this.dataCollectionModel.findOne({
      sessionId: session.sessionId,
    });

    if (previous) {
      record = previous;
      Object.keys(toDTO(session)).forEach((key) => {
        previous.set(key, session[key]);
      });
    }

    try {
      await record.save();
    } catch (e) {
      this.logger.warn(
        `Failed to save record sessionId=${record.sessionId}: ${e.stack}`,
      );
      return null;
    }

    this.emitter.emit('dataCollection.session.save', session, user);

    // const sessionEvent: SessionUpdateEventDto = {
    //   action: Action.Update,
    //   session: session,
    //   user: { email: user.email, name: user.name },
    // };

    //this.dataCollectionEventsService.eventUpdateSessionPub(sessionEvent); // Publish on mqtt broker

    this.logger.debug(`Saved session ${record.sessionId}`);
    return toDTO(record);
  }

  async downloadGroupData(groupId: string, res: Response): Promise<void> {
    return this.dataset.downloadGroupData(groupId, res);
  }

  async saveGroup(
    group: DataCollectionGroupDto,
    user: any,
  ): Promise<DataCollectionGroupDto> {
    this.emitter.emit('dataCollection.group.save', group, user);
    const session = await this.save(
      {
        groupId: group.groupId || uuidv4(),
      } as DataCollectionSessionDto,
      user,
    );
    if (session === null) throw new InternalServerErrorException();
    return { groupId: session.groupId };
  }

  async saveAttachment(
    groupId: string,
    file: Express.Multer.File,
  ): Promise<SaveAttachmentResponseDto> {
    const savedAttachment: SaveAttachmentResponseDto =
      await this.dataset.saveAttachmentInCache(groupId, file);
    this.emitter.emit(
      'dataCollection.attachment.save',
      file,
      groupId,
      savedAttachment,
    );
    return savedAttachment;
  }

  async getAttachment(
    groupId: string,
    attachmentId: string,
  ): Promise<StreamableFile | string> {
    return await this.dataset.getAttachment(groupId, attachmentId);
  }

  async deleteAttachment(groupId: string, attachmentId: string): Promise<void> {
    await this.dataset.deleteAttachment(groupId, attachmentId);
    this.emitter.emit(
      'dataCollection.attachment.delete',
      groupId,
      attachmentId,
    );
  }

  async importFromFile(file: Express.Multer.File, user: any) {
    const json = file.buffer.toString();
    //check if valid json
    try {
      const jsonObj = JSON.parse(json);
      //console.log(obj);
      await Promise.all(
        jsonObj.map(
          async (dataCollectionSession: DataCollectionSessionDto) =>
            await this.importFromJson(dataCollectionSession, user, true),
        ),
      );
    } catch (err: unknown) {
      this.logger.error(err);
      throw new BadRequestException('Not a valid JSON');
    }
  }

  async importFromJson(
    json: DataCollectionSessionDto,
    user: any,
    overrideTimestamp = false,
  ) {
    if (!json.groupId)
      throw new BadRequestException('groupId property is mandatory');
    json.sessionId =
      !json.sessionId || json.sessionId === '' ? null : json.sessionId;

    json.authorId =
      !json.authorId || json.authorId === '' ? null : json.authorId;

    const group = json.groupId;
    for (let c = 0; c < json.records.length; c++) {
      if (json.records[c].attachments.length === 1) {
        //content present
        const bufferedFile = Buffer.from(
          json.records[c].attachments[0].content,
          'utf-8',
        );
        try {
          const uuid: SaveAttachmentResponseDto =
            await this.dataset.saveAttachmentContentInCache(
              group,
              bufferedFile,
            );
          const file: Express.Multer.File = {
            fieldname: '',
            buffer: bufferedFile,
            originalname: '',
            encoding: '',
            mimetype: '',
            size: 0,
            stream: null,
            destination: '',
            filename: '',
            path: '',
          };
          //Save remotely
          this.emitter.emit(
            'dataCollection.attachment.save',
            file,
            group,
            uuid,
          );

          const newAttachement = {
            source: 'upload',
            reference: `${uuid.fileName}${uuid.ext}`,
            documentId: uuid.fileName,
            phrases: [],
          };
          json.records[c].attachments[0] = newAttachement;
        } catch (e) {
          console.log(e);
        }
      }
      // Override Dates to avoid future issues in update
      if (overrideTimestamp) {
        json.records[c].timestamp = this.randomDate(
          new Date(2020, 0, 1),
          new Date(),
        );
      }
    }
    // console.log(JSON.stringify(json, null, 6));
    await this.save(
      {
        groupId: json.groupId || uuidv4(),
        sessionId: json.sessionId || uuidv4(),
        label: json.label,
        authorId: json.authorId || user.preferred_username,
        created_at: json.created_at || null,
        modified_at: json.modified_at || null,
        records: json.records,
      } as DataCollectionSessionDto,
      user,
    );
  }

  async deleteGroup(groupId: string): Promise<DeleteResult> {
    return await this.dataCollectionModel.deleteMany({ groupId });
  }

  randomDate(start: Date, end: Date) {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  async deleteSession(sessionId: string): Promise<DeleteResult> {
    return await this.dataCollectionModel.deleteMany({ sessionId });
  }

  @OnEvent('dialogue.chat.message')
  async onSpeech(tts: DialogueMessageDto) {
    const record = {
      subject: tts.actor,
      intent: '',
      text: tts.text,
      slots: [],
      feedbacks: [],
      attachments: [],
      timestamp: new Date(),
      emotion: '',
      gesture: '',
      action: '',
    };
    const previousRecord = await this.dataCollectionModel.findOne({
      sessionId: tts.sessionId,
    });
    const records = previousRecord
      ? [...previousRecord.records, record]
      : [record];

    const sessionPayload: DataCollectionSessionDto = {
      authorId: 'kiosk',
      groupId: 'kiosk',
      sessionId: tts.sessionId,
      label: '',
      created_at: new Date(),
      modified_at: new Date(),
      records,
    };
    await this.save(sessionPayload);
  }
}

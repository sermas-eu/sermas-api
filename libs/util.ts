import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as YAML from 'js-yaml';
import { SermasBaseDto, SermasSessionDto } from 'libs/sermas/sermas.dto';
import { Document } from 'mongoose';
import * as path from 'path';

export { jwtDecode } from 'jwt-decode';

export { v4 as uuidv4 } from 'uuid';

const logger = new Logger('util');

export const getMongoDbUrl = (configService: ConfigService) => {
  const mongodbUri =
    configService.get<string>('MONGODB_URI') || 'mongodb://mongodb:27017';
  return `${mongodbUri}${isNodeEnv('test') ? '-test' : ''}`;
};

export const loadFile = <T = any>(
  filepath: string,
  failSilently = false,
): Promise<T> => {
  try {
    const ext = path.extname(filepath);
    if (ext === '.yaml' || ext === '.yml') return readYAML<T>(filepath);
    if (ext === '.json') return readJSON<T>(filepath);
    throw new Error(`Unsupported extension ${ext}`);
  } catch (e: any) {
    if (failSilently) {
      logger.debug(`Failed to load ${filepath}: ${e.stack}`);
      return null;
    }
    throw e;
  }
};

export const readJSON = async <T = any>(filepath: string): Promise<T> =>
  JSON.parse((await fs.readFile(filepath)).toString()) as T;

export const readYAML = async <T = any>(filepath: string): Promise<T> =>
  YAML.load((await fs.readFile(filepath)).toString()) as T;

export const createSecret = (): string => {
  return crypto.randomBytes(24).toString('hex');
};

export interface DtoContext {
  user?: AuthJwtUser;
  appId?: string;
  sessionId?: string;
}

export const extractTopicAppId = (topic: string): string | null => {
  const parts = topic.split('/');
  return parts[1] ? parts[1] : null;
};

export const addDTOContext = <T extends SermasSessionDto | SermasBaseDto>(
  dto: T,
  context?: DtoContext,
): T | null => {
  if (!dto) return null;
  if (!context) return dto;

  dto.ts = dto.ts || new Date();

  if (context.user) {
    dto.clientId = context.user.sid;
  }

  if (context.appId) dto.appId = dto.appId || context.appId;
  if (context.sessionId) {
    const dto1 = dto as any;
    dto1.sessionId = dto1.sessionId || context.sessionId;
    dto = { ...dto1 };
  }

  return dto as T;
};

export const toDTO = <T = any>(doc: Document | any): T => {
  const dto = doc.toJSON ? ({ ...doc.toJSON() } as any) : { ...doc };
  if (dto.__v !== undefined) delete dto.__v;
  if (dto._id !== undefined) delete dto._id;
  return dto as T;
};

export const mapMqttTopic = (
  topic: string,
  params?: any,
  ...suffix: string[]
) => {
  if (params) {
    const keys = Object.keys(params).filter(
      (k) => typeof params[k] === 'string' || typeof params[k] === 'number',
    );
    if (keys.length) {
      topic = keys.reduce(
        (topic, key) => topic.replace(new RegExp(`:${key}`, 'g'), params[key]),
        topic,
      );
    }
  }

  const leftovers = topic.indexOf(':') > -1;
  if (leftovers) {
    throw new InternalServerErrorException(
      `Unmapped topic variable ${leftovers[0]} for topic ${topic}`,
    );
  }

  topic = topic + (suffix && suffix.length ? '/' + suffix.join('/') : '');
  return topic;
};

export const isNodeEnv = (
  env: 'production' | 'test' | 'development',
): boolean => {
  return process.env.NODE_ENV === env;
};

export enum WaitEventsMode {
  'AT_LEAST_ONE',
  'ALL',
}
export type WaitEventsReceived = Record<string, (unknown | null)[]>;

export const waitEvents = async (
  emitter: EventEmitter2,
  events: string[] | string,
  timeout = 500,
  mode = WaitEventsMode.AT_LEAST_ONE,
): Promise<WaitEventsReceived> => {
  const eventsList = typeof events === 'string' ? [events] : events;

  if (!eventsList || eventsList.length === 0) return {};

  return new Promise((resolve) => {
    const received: WaitEventsReceived = {};
    let done = false;
    let reachedTimeout = false;

    const checkCompletion = () => {
      const values = Object.values(received);
      const receivedEventsCounts = values.filter(
        (val) => val.length && val.filter((v) => v !== null).length,
      ).length;
      if (
        reachedTimeout ||
        (mode === WaitEventsMode.AT_LEAST_ONE && receivedEventsCounts > 0) ||
        (mode === WaitEventsMode.ALL &&
          receivedEventsCounts === eventsList.length)
      ) {
        if (done) return;
        done = true;
        resolve(received);
      }
    };

    eventsList.forEach((eventName) => {
      received[eventName] = received[eventName] || [];

      emitter.once(eventName, (ev: unknown) => {
        received[eventName].push(ev);
        checkCompletion();
      });

      setTimeout(() => {
        reachedTimeout = true;
        checkCompletion();
      }, timeout);
    });
  });
};

export const capitalize = (str: string) =>
  str ? str.substring(0, 1).toUpperCase() + str.substring(1) : '';

export const fileExists = (file: string): Promise<boolean> => {
  return fs
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

export const hash = (s: string) => {
  return s.split('').reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
};

export const md5 = (s: string) =>
  crypto.createHash('md5').update(s).digest('hex');

export const deepcopy = <T = any>(value: any): T => {
  if (typeof value === 'object' || value instanceof Array)
    return JSON.parse(JSON.stringify(value)) as T;

  return value as T;
};

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';
import { SelectedTool } from 'apps/dialogue/src/avatar/dialogue.chat.tools.dto';
import { SermasRecordChangedOperation } from 'libs/sermas/sermas.dto';
import { deepcopy, uuidv4 } from 'libs/util';
import { DialogueToolNotMatchingDto } from '../dialogue.chat.dto';
import { DialogueToolsAsyncApiService } from './dialogue.tools.async.service';
import { DialogueToolsRepositoryChanged } from './dialogue.tools.dto';
import {
  DialogueToolsRepositoryDto,
  DialogueToolsRepositoryRecordDto,
} from './repository/dialogue.tools.repository.dto';
import { DialogueToolsRepositoryService } from './repository/dialogue.tools.repository.service';
import { ToolTriggerEventDto } from './trigger/dialogue.tools.trigger.dto';
import { DialogueToolsTriggerService } from './trigger/dialogue.tools.trigger.service';

type ToolsSchemaValues = string | number | boolean | object | undefined;
type ToolsSchemaParameters = Record<string, ToolsSchemaValues>;

@Injectable()
export class DialogueToolsService {
  private readonly logger = new Logger(DialogueToolsService.name);

  constructor(
    private readonly toolsRepository: DialogueToolsRepositoryService,
    private readonly toolsTrigger: DialogueToolsTriggerService,
    private readonly emitter: EventEmitter2,
    private readonly async: DialogueToolsAsyncApiService,
  ) {}

  publishNotMatching(ev: DialogueToolNotMatchingDto) {
    this.async.toolNotMatching({
      appId: ev.appId,
      sessionId: ev.sessionId,
      taskId: ev.currentTask?.taskId,
      repositories: ev.repositories.map((r) => r.repositoryId),
      tools: ev.tools,
      currentField: ev.currentField,
    });
  }

  trigger(ev: ToolTriggerEventDto) {
    return this.toolsTrigger.trigger(ev);
  }

  async loadFromSession(message: {
    appId: string;
    sessionId?: string;
  }): Promise<DialogueToolsRepositoryRecordDto[]> {
    // load tools
    const appRepository = await this.get(message.appId);

    const sessionRepositories = await this.search({
      sessionId: message.sessionId,
      appId: message.appId,
    });

    const repositories = sessionRepositories.length
      ? sessionRepositories
      : appRepository
        ? [appRepository]
        : [];

    return repositories;
  }

  async search(
    context: Partial<DialogueToolsRepositoryDto>,
    recordCallback?: (
      repository: DialogueToolsRepositoryRecordDto,
    ) => Promise<void> | void,
  ): Promise<DialogueToolsRepositoryRecordDto[]> {
    this.logger.verbose(`Searching by context=${JSON.stringify(context)}`);

    if (Object.keys(context).length === 0) {
      this.logger.warn(`Empty query, skip`);
      return [];
    }

    const repositories = await this.toolsRepository.search(context);
    this.logger.verbose(`Found ${repositories.length} repositories`);

    if (recordCallback) {
      for (const repository of repositories) {
        this.logger.verbose(
          `Processing repository repositoryId=${repository.repositoryId}`,
        );
        try {
          await recordCallback(repository);
        } catch (e: any) {
          this.logger.error(
            `Error processing repository repositoryId=${repository.repositoryId}: ${e.message}`,
          );
          this.logger.debug(e.stack);
          continue;
        }
      }
    }

    return repositories;
  }

  async get(
    repositoryId: string,
    failIfNotFound = false,
  ): Promise<DialogueToolsRepositoryRecordDto | null> {
    if (!repositoryId) {
      if (failIfNotFound) throw new BadRequestException(`Missing repositoryId`);
      return null;
    }

    const repository = await this.toolsRepository.read(repositoryId, false);

    if (!repository && failIfNotFound)
      throw new NotFoundException(
        `Repository not found for repositoryId=${repositoryId}`,
      );

    return repository || null;
  }

  async set(repo: DialogueToolsRepositoryDto) {
    try {
      let repository = await this.get(repo.repositoryId, false);

      if (!repo.tools || !repo.tools.length) {
        // if no tools, delete record
        if (repository) await this.delete(repository.repositoryId);
        return deepcopy<DialogueToolsRepositoryRecordDto>(repo);
      }

      if (!repository) {
        repository = {
          ...repo,
          repositoryId: repo.repositoryId || uuidv4(),
          appId: repo.appId,
          sessionId: repo.sessionId,
          tools: repo.tools,
          options: repo.options,
        };
      }

      repository.tools = repo.tools;

      this.logger.verbose(
        `Set tools to repositoryId=${repository.repositoryId} sessionId=${repository.sessionId}`,
      );

      await this.toolsRepository.save(repository);
      this.publishChanged('created', repository);

      return repository;
    } catch (e) {
      this.logger.warn(`Error on set: ${e.stack}`);
    }
    return repo;
  }

  async add(repo: DialogueToolsRepositoryDto) {
    if (!repo.tools?.length)
      return deepcopy<DialogueToolsRepositoryRecordDto>(repo);
    try {
      const repository = await this.get(repo.repositoryId, false);
      if (!repository) return await this.set(repo);

      repository.tools = repository.tools || [];
      // remove previous tools by name
      repository.tools = repository.tools.filter(
        (tool) => repo.tools.filter((t) => t.name === tool.name).length === 0,
      );
      repository.tools = [...(repository.tools || []), ...(repo.tools || [])];

      repository.options = repo.options;

      this.logger.verbose(
        `Added tools to repositoryId=${repository.repositoryId} sessionId=${repository.sessionId}`,
      );
      await this.toolsRepository.save(repository);

      this.publishChanged('updated', repository);

      return repository;
    } catch (e) {
      this.logger.warn(`Error adding tool :${e.stack}`);
    }
    return repo;
  }

  async delete(repositoryId: string) {
    const repository = await this.get(repositoryId, false);
    if (!repository) return;

    this.logger.verbose(
      `Delete record for repositoryId=${repository.repositoryId} sessionId=${repository.sessionId}`,
    );
    await this.toolsRepository.remove(repository.repositoryId);
    this.publishChanged('deleted', repository);
  }

  async publishChanged(
    operation: SermasRecordChangedOperation,
    record: DialogueToolsRepositoryRecordDto,
  ) {
    const ev: DialogueToolsRepositoryChanged = {
      appId: record.appId,
      sessionId: record.sessionId,
      operation,
      record,
      ts: new Date(),
    };
    this.emitter.emit('dialogue.tool.changed', ev);
    this.async.toolChanged(ev);
  }

  getSchemaValues<T extends ToolsSchemaParameters = ToolsSchemaParameters>(
    tool: AppToolsDTO,
  ): T {
    const values: ToolsSchemaParameters = {};

    if (!tool.schema) return values as T;

    tool.schema.forEach((schema) => (values[schema.parameter] = schema.value));

    return values as T;
  }

  getSchemaValue(tool: AppToolsDTO, parameterName: string) {
    const values = this.getSchemaValues(tool);
    return values[parameterName];
  }

  getRepositoryByTool(
    repositories: DialogueToolsRepositoryDto[],
    tool: SelectedTool<{
      [param: string]: any;
    }>,
  ): DialogueToolsRepositoryDto | null {
    const matchingRepositories = (repositories || []).filter(
      (r) => (r.tools || []).filter((t) => t.name === tool.name).length,
    );
    const matchingRepository = matchingRepositories.length
      ? matchingRepositories[0]
      : null;
    return matchingRepository || null;
  }
}

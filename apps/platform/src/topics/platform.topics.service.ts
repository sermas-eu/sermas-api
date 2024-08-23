import { Injectable, Logger } from '@nestjs/common';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { PlatformTopic, PlatformTopicMap } from './platform.topics.dto';

@Injectable()
export class PlatformTopicsService {
  private readonly logger = new Logger(PlatformTopicsService.name);

  private topics: PlatformTopicMap = {};

  constructor() {
    // set initial values
    this.reset();
  }

  addResource(
    resource: string,
    scope: string,
    context?: string[],
    prefix = 'app/:appId',
  ) {
    this.topics[resource] = this.topics[resource] || {};
    this.topics[resource][scope] = `${prefix}/${resource}/${scope}${
      context && context.length ? '/' + context.join('/') : ''
    }`;
  }

  reset() {
    this.topics = { ...SermasTopics };
  }

  // expects a `resource.scope` format
  addFromResources(resources: string[], prefix?: string) {
    if (!resources || !resources.length) return;
    resources
      .map((res) => res.split('.'))
      .filter((res) => res.length >= 2)
      .forEach((res) => this.addResource(res[0], res[1], res.slice(2), prefix));
  }

  // expects a `resource.scope` format
  removeFromResources(resources: string[]) {
    if (!resources || !resources.length) return;
    resources
      .map((res) => res.split('.'))
      .filter((res) => res.length >= 2)
      .forEach((res) => this.remove(res[0], res[1]));
  }

  remove(resource: string, scope?: string) {
    if (!this.topics[resource]) return;

    if (!scope) {
      delete this.topics[resource];
      return;
    }

    if (!this.topics[resource][scope]) return;
    delete this.topics[resource][scope];
  }

  toTree(
    topicsList?: PlatformTopic[],
    aliasScopes = false,
  ): Record<string, string[]> {
    topicsList = topicsList || this.toJSON();
    const resources = topicsList.reduce((o, { resource, scope }) => {
      o[resource] = o[resource] || [];
      if (!o[resource].includes(scope))
        o[resource].push(aliasScopes ? `${resource}:${scope}` : scope);
      return o;
    }, {});
    return resources;
  }

  toJSON(topics?: PlatformTopicMap): PlatformTopic[] {
    topics = topics || this.topics;
    const list = Object.values(topics)
      .reduce((a, c) => [...a, ...Object.values(c)], [])
      .map((l) => l.split('/'))
      .map((parts) => {
        const prefix = parts.splice(0, 2);
        const [resource, scope] = parts;
        return {
          resource,
          scope,
          context: parts.slice(2),
          prefix: prefix.join('/'),
        };
      });

    return list;
  }

  getTopicsList(topics?: PlatformTopicMap): string[] {
    topics = topics || this.topics;
    return Object.keys(topics).reduce((list, res) => {
      return [
        ...list,
        ...Object.keys(topics[res]).map((scope) => topics[res][scope]),
      ];
    }, [] as string[]);
  }
}

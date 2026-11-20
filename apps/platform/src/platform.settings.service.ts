import { Injectable, Logger } from '@nestjs/common';
import {
  PlatformSettingsDto,
  PlatformSettingsParamsDto,
} from './platform.dto.js';
import { PlatformKeycloakService } from './platform.keycloack.service.js';
import { PlatformTopicsService } from './topics/platform.topics.service.js';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    private readonly keycloak: PlatformKeycloakService,
    private readonly topics: PlatformTopicsService,
  ) {}

  async getSettings(
    params: PlatformSettingsParamsDto,
  ): Promise<PlatformSettingsDto> {
    let topics = this.topics.toTree();

    if (params.user && params.filterByPermissions === true) {
      const resources = await this.keycloak.getAllowedResources(
        params.user.azp,
        params.user.sub,
      );

      topics = {};
      resources.results
        .filter((r) => r.status === 'PERMIT')
        .map((r) => r.allowedScopes.map((s) => s.name.split(':').slice(0, 2)))
        .forEach((scopeParts) => {
          scopeParts.forEach(([resourceName, scopeName]) => {
            if (!resourceName || !scopeName) return;
            topics[resourceName] = Array.from(
              new Set([...(topics[resourceName] || []), scopeName]),
            );
          });
        });
    }

    const settings: PlatformSettingsDto = {
      resources: topics,
    };

    return settings;
  }
}

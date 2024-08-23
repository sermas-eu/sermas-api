import { Injectable, Logger } from '@nestjs/common';
import { ClientPermissionDto } from 'apps/keycloak/src/keycloak.dto';
import { PlatformAuthService } from './platform.auth.service';
import { OnEvent } from '@nestjs/event-emitter';
import { Payload, Subscribe } from 'libs/mqtt-handler/mqtt.decorator';
import { SermasTopics } from 'libs/sermas/sermas.topic';
import { PlatformAppClientChangedDto } from '../app/platform.app.dto';

interface TokenCache {
  expires: number;
  clientId: string;
  permissions: ClientPermissionDto[];
}

@Injectable()
export class PlatformAuthEventsService {
  private readonly logger = new Logger(PlatformAuthEventsService.name);

  private readonly allowedClients: string[];

  private readonly cache: Record<string, TokenCache> = {};

  constructor(private readonly auth: PlatformAuthService) {}

  @Subscribe({
    topic: SermasTopics.platform.clientChanged,
    args: {
      appId: '+',
      clientId: '+',
    },
  })
  onClientChanged(@Payload() ev: PlatformAppClientChangedDto) {
    if (ev.clientId) this.auth.clearCache(ev.clientId);
  }
}

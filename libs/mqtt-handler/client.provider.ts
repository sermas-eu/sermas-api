import { Logger, Provider } from '@nestjs/common';
// import { getKeycloakAccessToken } from 'apps/auth/src/libs/token-client';
import { KeycloakTokenDto } from '#apps/keycloak/src/keycloak.admin.dto';
import { KeycloakService } from '#apps/keycloak/src/keycloak.service';
import { isNodeEnv } from '#libs/util';
import { IClientOptions, MqttClient, connect } from 'mqtt';
import {
  MQTT_CLIENT_INSTANCE,
  MQTT_LOGGER_PROVIDER,
  MQTT_OPTION_PROVIDER,
} from './mqtt.constants.js';
import { MqttModuleOptions } from './mqtt.interface.js';

// after this many failures in a row, warn louder; retries never stop
const MAX_CONN_RETRIES = 5;
const MAX_RETRY_DELAY = 30 * 1000;
const REFRESH_BEFORE = 60 * 1000;

interface TokenResponse {
  token: string;
  expires: Date;
}

const getToken = async (
  keycloak: KeycloakService,
  options: MqttModuleOptions,
  logger: Logger,
): Promise<TokenResponse> => {
  let res: KeycloakTokenDto;

  try {
    res = await keycloak.getClientAccessToken({
      clientId: options.keycloakServiceAccountClientId,
      clientSecret: options.keycloakClientSecret,
      realm: options.keycloakRealm,
    });
  } catch (e: any) {
    logger.error(`Failed to get MQTT connection token: ${e.message}`);
  }

  if (!res) {
    logger.error(`MQTT connection token is empty`);
    return {
      token: null,
      expires: new Date(),
    };
  }

  const token = res.access_token;
  const expires = new Date(res.expires_in * 1000 + Date.now());
  // expires = new Date(Date.now() + 10 * 1000);
  logger.debug(
    `MQTT token expires in ${Math.round(res.expires_in / 60 / 60)}min`,
  );
  return { token, expires };
};

export function createClientProvider(): Provider {
  return {
    provide: MQTT_CLIENT_INSTANCE,
    inject: [MQTT_OPTION_PROVIDER, MQTT_LOGGER_PROVIDER, KeycloakService],
    useFactory: async (
      options: MqttModuleOptions,
      logger: Logger,
      keycloak: KeycloakService,
    ) => {
      let client: MqttClient = null;
      let tokenResponse: TokenResponse;

      let reloadingToken = false;
      let retries = 0;

      let lastReload = 0;
      const reloadToken = async () => {
        if (reloadingToken) return;
        // every failed reconnect asks for a reload: one token request at most
        // every 2s is enough
        if (Date.now() - lastReload < 2000) return;
        if (
          tokenResponse?.expires &&
          tokenResponse?.expires.getTime() - Date.now() > REFRESH_BEFORE
        ) {
          return;
        }

        if (!client || !tokenResponse) return;

        reloadingToken = true;
        lastReload = Date.now();
        try {
          logger.debug(`Refreshing MQTT token`);
          const { expires, token } = await getToken(keycloak, options, logger);

          // update local expires reference
          tokenResponse.token = token;
          tokenResponse.expires = expires;

          client.options = {
            ...(client.options || mqttOptions),
            username: tokenResponse.token || '',
          };

          // force: a graceful end of a never-connected client does not
          // complete, and the deferred reconnect would never run
          client.end(true, {}, () => client.reconnect());
        } finally {
          reloadingToken = false;
        }
      };

      // setup mqtt options
      const getMqttOptions = async () => {
        const {
          keycloakServiceAccountUsername,
          keycloakServiceAccountPassword,
        } = options;

        const mqttOptions: IClientOptions = {
          host: options.host,
          username: '',
          password: 'none',
          // protocolVersion: 5,
        };

        const hasCredentials =
          keycloakServiceAccountUsername && keycloakServiceAccountPassword;

        if (!hasCredentials) {
          tokenResponse = await getToken(keycloak, options, logger);
          if (!tokenResponse.token) {
            // e.g. the realm does not exist yet on a first boot: the refresh
            // below retries until it does
            logger.warn('No MQTT token yet, retrying');
          }
          mqttOptions.username = tokenResponse.token || '';
          setInterval(reloadToken, 10 * 1000);
        } else {
          logger.debug(`Using configuration username/password`);
          mqttOptions.username = keycloakServiceAccountUsername;
          mqttOptions.password = keycloakServiceAccountPassword;
        }

        return mqttOptions;
      };

      const mqttOptions = await getMqttOptions();
      client = connect(mqttOptions);

      client.on('connect', () => {
        logger.log('MQTT connected');
        retries = 0;
      });

      client.on('disconnect', () => {
        logger.warn('MQTT disconnected');
      });

      client.on('error', (error) => {
        logger.error(`MQTT Error: ${error.message}`);

        retries++;
        if (retries === MAX_CONN_RETRIES) {
          logger.error(
            `MQTT connection failed ${retries} times: check that mqtt and keycloak are running. Still retrying.`,
          );
        }
        setTimeout(reloadToken, Math.min(MAX_RETRY_DELAY, 2000 * retries));
      });

      client.on('reconnect', () => {
        if (isNodeEnv('test')) {
          logger.warn('Stopping MQTT reconnection in test mode');
          client.end();
          return;
        }
        // logger.log('MQTT reconnecting');
      });

      client.on('close', () => {
        // logger.warn(`MQTT closed`);
      });

      client.on('offline', () => {
        logger.warn('MQTT offline');
      });

      return client;
    },
  };
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  SermasApiConfig,
  SermasDefaultConfig,
} from 'libs/sermas/sermas.defaults';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_PATH
        ? [process.env.ENV_PATH]
        : ['.env.production', '.env.staging', '.env.test', '.env'],
      load: [
        (): Partial<SermasApiConfig> => {
          const defaults: Partial<SermasApiConfig> = { ...SermasDefaultConfig };
          Object.keys(defaults).forEach((key) => {
            if (process.env[key] !== undefined) {
              delete defaults[key];
            }
          });
          // console.warn(defaults, process.env);
          return defaults;
        },
      ],
    }),
  ],
})
export class SermasConfigModule {}

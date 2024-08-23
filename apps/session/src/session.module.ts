import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'apps/auth/src/auth.module';
import { SessionAgentModule } from './agent/session.agent.module';
import { SessionAsyncApiService } from './session.async.service';
import { SessionController } from './session.controller';
import { SessionEventsService } from './session.events.service';
import { Session, SessionSchema } from './session.schema';
import { SessionService } from './session.service';
import { SessionStorageModule } from './storage/session.storage.module';
import { SessionSupportAsyncApiService } from './support/session.support.async.service';
import { SessionSupportController } from './support/session.support.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    AuthModule,
    SessionStorageModule,
    SessionAgentModule,
  ],
  providers: [
    SessionService,
    SessionEventsService,
    SessionAsyncApiService,
    SessionSupportAsyncApiService,
  ],
  controllers: [SessionController, SessionSupportController],
  exports: [SessionService],
})
@Global()
export class SessionModule {}

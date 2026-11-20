import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '#apps/auth/src/auth.module';
import { SessionAgentModule } from './agent/session.agent.module.js';
import { SessionAsyncApiService } from './session.async.service.js';
import { SessionController } from './session.controller.js';
import { SessionEventsService } from './session.events.service.js';
import { Session, SessionSchema } from './session.schema.js';
import { SessionService } from './session.service.js';
import { SessionStorageModule } from './storage/session.storage.module.js';
import { SessionSupportAsyncApiService } from './support/session.support.async.service.js';
import { SessionSupportController } from './support/session.support.controller.js';
import { SessionLLMContextHandlerService } from './session.llm-context.handler.js';

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
    SessionLLMContextHandlerService,
  ],
  controllers: [SessionController, SessionSupportController],
  exports: [SessionService],
})
@Global()
export class SessionModule {}

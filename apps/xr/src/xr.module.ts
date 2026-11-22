import { Module } from '@nestjs/common';
import { AuthModule } from '#apps/auth/src/auth.module';
import { XRMarkerAsyncApiService } from './xr.marker.async.service.js';
import { XRMarkerController } from './xr.marker.controller.js';
import { XrMarkerService } from './xr.marker.service.js';
import { XROcclusionAsyncApiService } from './xr.occlusion.async.service.js';
import { XROcclusionController } from './xr.occlusion.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [XRMarkerController, XROcclusionController],
  providers: [
    XRMarkerAsyncApiService,
    XROcclusionAsyncApiService,
    XrMarkerService,
  ],
})
export class XrModule {}

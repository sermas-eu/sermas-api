import { Module } from '@nestjs/common';
import { AuthModule } from 'apps/auth/src/auth.module';
import { XRMarkerAsyncApiService } from './xr.marker.async.service';
import { XRMarkerController } from './xr.marker.controller';
import { XrMarkerService } from './xr.marker.service';
import { XROcclusionAsyncApiService } from './xr.occlusion.async.service';
import { XROcclusionController } from './xr.occlusion.controller';

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

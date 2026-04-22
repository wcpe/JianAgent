import { Module } from '@nestjs/common';
import { PlatformObservabilityService } from './platform-observability.service.js';

@Module({
  providers: [PlatformObservabilityService],
  exports: [PlatformObservabilityService],
})
export class PlatformObservabilityModule {}

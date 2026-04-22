import { Controller, Get } from '@nestjs/common';
import type { PlatformRuntimeCapabilityDto } from '@jian-agent/shared-domain';
import { PlatformRuntimeService } from './platform-runtime.service.js';

@Controller('api/platform/runtime')
export class PlatformRuntimeController {
  constructor(private readonly platformRuntimeService: PlatformRuntimeService) {}

  @Get('capabilities')
  getCapabilities(): PlatformRuntimeCapabilityDto {
    return this.platformRuntimeService.getCapabilities();
  }
}

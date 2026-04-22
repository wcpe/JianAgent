import { Module } from '@nestjs/common';
import { PlatformRuntimeController } from './platform-runtime.controller.js';
import { PlatformRuntimeService } from './platform-runtime.service.js';

@Module({
  controllers: [PlatformRuntimeController],
  providers: [PlatformRuntimeService],
  exports: [PlatformRuntimeService],
})
export class PlatformRuntimeModule {}

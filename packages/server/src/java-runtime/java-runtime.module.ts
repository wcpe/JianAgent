import { Module } from '@nestjs/common';
import { JavaRuntimeService } from './java-runtime.service.js';
import { JavaRuntimeDiscoveryService } from './java-runtime-discovery.service.js';
import { JavaRuntimeMapper } from './java-runtime.mapper.js';

@Module({
  providers: [JavaRuntimeService, JavaRuntimeDiscoveryService, JavaRuntimeMapper],
  exports: [JavaRuntimeService, JavaRuntimeDiscoveryService],
})
export class JavaRuntimeModule {}

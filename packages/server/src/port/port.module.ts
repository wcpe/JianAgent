import { Module } from '@nestjs/common';
import { JvmCapabilityModule } from '../jvm-capability/jvm-capability.module.js';
import { PortController } from './port.controller.js';
import { PortService } from './port.service.js';

@Module({
  imports: [JvmCapabilityModule],
  controllers: [PortController],
  providers: [PortService],
  exports: [PortService],
})
export class PortModule {}

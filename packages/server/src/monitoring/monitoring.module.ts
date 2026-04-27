import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service.js';
import { MonitoringGateway } from './monitoring.gateway.js';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';

@Module({
  imports: [JavaHelperModule],
  providers: [MonitoringService, MonitoringGateway],
  exports: [MonitoringService],
})
export class MonitoringModule {}

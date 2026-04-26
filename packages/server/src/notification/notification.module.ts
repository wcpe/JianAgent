import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { SshModule } from '../ssh/ssh.module.js';

@Module({
  imports: [MetricsModule, SshModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

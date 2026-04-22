import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller.js';
import { BackupService } from './backup.service.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';

@Module({
  imports: [ServerProcessModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}

import { Module } from '@nestjs/common';
import { FileManagerController } from './file-manager.controller.js';
import { FileManagerService } from './file-manager.service.js';
import { FileVersionService } from './file-version.service.js';
import { LocalFileProvider } from './local-file.provider.js';
import { FileTaskMapper } from './file-task.mapper.js';
import { FileTaskService } from './file-task.service.js';
import { FileTaskExecutor } from './file-task.executor.js';
import { SshModule } from '../ssh/ssh.module.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [SshModule, ServerProcessModule, AuditModule],
  controllers: [FileManagerController],
  providers: [
    FileManagerService,
    FileVersionService,
    LocalFileProvider,
    FileTaskMapper,
    FileTaskService,
    FileTaskExecutor,
  ],
  exports: [FileManagerService, FileTaskService, FileTaskExecutor],
})
export class FileManagerModule {}

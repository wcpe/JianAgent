import { Module } from '@nestjs/common';
import { PtyManagerService } from './pty-manager.service.js';
import { PtyPermissionService } from './pty-permission.service.js';
import { PtyAuditService } from './pty-audit.service.js';
import { DebugRecorderService } from './debug-recorder.service.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { SshModule } from '../ssh/ssh.module.js';

@Module({
  imports: [ServerProcessModule, SshModule],
  providers: [PtyManagerService, PtyPermissionService, PtyAuditService, DebugRecorderService],
  exports: [PtyManagerService, PtyPermissionService, PtyAuditService, DebugRecorderService],
})
export class PtyModule {}

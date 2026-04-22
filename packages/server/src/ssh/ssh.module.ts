import { Module, forwardRef } from '@nestjs/common';
import { SshCryptoService } from './ssh-crypto.service.js';
import { SshPoolService } from './ssh-pool.service.js';
import { SshTerminalService } from './ssh-terminal.service.js';
import { SftpFileService } from './sftp-file.service.js';

@Module({
  providers: [SshCryptoService, SshPoolService, SshTerminalService, SftpFileService],
  exports: [SshCryptoService, SshPoolService, SshTerminalService, SftpFileService],
})
export class SshModule {}

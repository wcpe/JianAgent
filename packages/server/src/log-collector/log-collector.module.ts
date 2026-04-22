import { Module } from '@nestjs/common';
import { LogParserService } from './log-parser.service.js';
import { LogIngestService } from './log-ingest.service.js';
import { LogIngestController } from './log-ingest.controller.js';
import { LocalLogReaderService } from './local-log-reader.service.js';
import { SshLogReaderService } from './ssh-log-reader.service.js';
import { SshModule } from '../ssh/ssh.module.js';

@Module({
  imports: [SshModule],
  controllers: [LogIngestController],
  providers: [
    LogParserService,
    LogIngestService,
    LocalLogReaderService,
    SshLogReaderService,
  ],
  exports: [LogParserService, LogIngestService],
})
export class LogCollectorModule {}

import { Module, Global } from '@nestjs/common';
import { SessionRegistry } from './session-registry.js';
import { TerminalSessionService } from './terminal-session.service.js';

@Global()
@Module({
  providers: [SessionRegistry, TerminalSessionService],
  exports: [SessionRegistry, TerminalSessionService],
})
export class TerminalSessionModule {}

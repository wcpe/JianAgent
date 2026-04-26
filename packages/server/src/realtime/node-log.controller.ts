import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { NodeLogBridgeService } from './node-log-bridge.service.js';

@Controller('node-log')
@UseGuards(JwtGuard, RolesGuard)
export class NodeLogController {
  constructor(private readonly logBridge: NodeLogBridgeService) {}

  @Get('history')
  @Roles(RoleLevel.VIEWER)
  getLogHistory(
    @Query('levels') levelsStr?: string,
    @Query('keyword') keyword?: string,
    @Query('format') format?: string,
  ) {
    if (format === 'raw') {
      return { lines: this.logBridge.getLogBuffer().map(e => e.raw) };
    }
    const levels = levelsStr?.split(',').map(s => s.trim()).filter(Boolean);
    return { entries: this.logBridge.getFilteredBuffer(levels, keyword) };
  }
}

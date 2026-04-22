import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { NodeLogBridgeService } from './node-log-bridge.service.js';

@Controller('api/node-log')
@UseGuards(JwtGuard, RolesGuard)
export class NodeLogController {
  constructor(private readonly logBridge: NodeLogBridgeService) {}

  @Get('history')
  @Roles(RoleLevel.VIEWER)
  getLogHistory() {
    return { lines: this.logBridge.getLogBuffer() };
  }
}

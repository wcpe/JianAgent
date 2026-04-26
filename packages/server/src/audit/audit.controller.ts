import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditStoreService } from '../storage/audit-store.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import type { AuditQueryParams } from '@jian-agent/shared-domain';

@Controller('audit')
@UseGuards(JwtGuard, RolesGuard)
export class AuditController {
  constructor(private readonly store: AuditStoreService) {}

  @Get()
  @Roles(RoleLevel.ADMIN)
  async query(
    @Query('userId') userId?: string,
    @Query('operation') operation?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const params: AuditQueryParams = {
      userId,
      operation,
      startTime,
      endTime,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.store.query(params);
  }
}

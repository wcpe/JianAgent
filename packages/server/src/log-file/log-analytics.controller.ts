import { Controller, Get, Query } from '@nestjs/common';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Roles } from '../auth/roles.decorator.js';
import { LogSearchService } from './log-search.service.js';

@Controller('logs/analytics')
export class LogAnalyticsController {
  constructor(private readonly logSearchService: LogSearchService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  analytics(
    @Query('hostId') hostId?: string,
    @Query('hosts') hostsStr?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('buckets') bucketsStr?: string,
  ) {
    const buckets = bucketsStr ? Math.min(200, Math.max(1, parseInt(bucketsStr, 10) || 24)) : 24;
    const resolvedHostId = hostId?.trim()
      || hostsStr?.split(',').map((item) => item.trim()).find(Boolean)
      || undefined;
    return {
      success: true,
      data: this.logSearchService.getAnalytics({
        hostId: resolvedHostId,
        startTime,
        endTime,
        buckets,
      }),
    };
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { LogSearchService } from './log-search.service.js';

@Controller('logs')
@UseGuards(JwtGuard, RolesGuard)
export class LogExportController {
  constructor(private readonly searchService: LogSearchService) {}

  @Get('export')
  @Roles(RoleLevel.VIEWER)
  async exportLogs(
    @Query('q') q?: string,
    @Query('hosts') hostsStr?: string,
    @Query('level') level?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('format') format: string = 'csv',
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(10000, Math.max(1, parseInt(limitStr ?? '5000', 10) || 5000));
    const hosts = hostsStr?.split(',').filter(Boolean);
    const result = this.searchService.ftsSearch({ q, hosts, level, startTime, endTime, page: 1, limit });

    if (format === 'json') {
      return { success: true, data: { format: 'json', entries: result.entries } };
    }

    // CSV format
    const header = 'timestamp,level,host,source,content';
    const rows = result.entries.map(e =>
      [e.timestamp, e.level, e.hostName, e.sourceFile, `"${(e.content ?? '').replace(/"/g, '""')}"`].join(',')
    );
    return { success: true, data: { format: 'csv', content: [header, ...rows].join('\n'), total: result.total } };
  }
}

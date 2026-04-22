import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Roles } from '../auth/roles.decorator.js';
import { LogQueryStrategyService } from './log-query-strategy.service.js';

@Controller('api/logs')
export class LogQueryController {
  constructor(private readonly logQueryStrategy: LogQueryStrategyService) {}

  @Get('aggregate')
  @Roles(RoleLevel.VIEWER)
  async aggregate(
    @Query('q') query?: string,
    @Query('serverIds') serverIdsStr?: string,
    @Query('maxPerServer') maxPerServerStr?: string,
    @Query('maxTotal') maxTotalStr?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('caseSensitive') caseSensitiveStr?: string,
    @Query('fields') fieldsStr?: string,
  ) {
    const normalizedQuery = query?.trim() ?? '';
    if (normalizedQuery === '') {
      throw new BadRequestException('缺少搜索关键词 q');
    }
    if (normalizedQuery.length > 256) {
      throw new BadRequestException('搜索关键词过长，请控制在 256 字符以内');
    }

    const serverIds = serverIdsStr
      ? Array.from(new Set(serverIdsStr.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 200)
      : undefined;
    const maxPerServer = parseInt(maxPerServerStr ?? '200', 10);
    const maxTotal = parseInt(maxTotalStr ?? '500', 10);
    const caseSensitive = caseSensitiveStr === 'true';
    const normalizedStartTime = startTime && !Number.isNaN(Date.parse(startTime)) ? startTime : undefined;
    const normalizedEndTime = endTime && !Number.isNaN(Date.parse(endTime)) ? endTime : undefined;
    if (normalizedStartTime && normalizedEndTime && Date.parse(normalizedStartTime) > Date.parse(normalizedEndTime)) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }
    const fields = fieldsStr
      ? fieldsStr.split(',').map((item) => item.trim()).filter((item): item is 'content' | 'file' => item === 'content' || item === 'file')
      : undefined;

    return this.logQueryStrategy.aggregateSearch({
      query: normalizedQuery,
      serverIds,
      maxPerServer: Number.isFinite(maxPerServer) ? maxPerServer : 200,
      maxTotal: Number.isFinite(maxTotal) ? maxTotal : 500,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      caseSensitive,
      fields,
    });
  }

  @Get('recent')
  @Roles(RoleLevel.VIEWER)
  async recent(
    @Query('serverIds') serverIdsStr?: string,
    @Query('linesPerServer') linesPerServerStr?: string,
    @Query('maxTotal') maxTotalStr?: string,
  ) {
    const serverIds = serverIdsStr
      ? Array.from(new Set(serverIdsStr.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 200)
      : undefined;
    const linesPerServer = parseInt(linesPerServerStr ?? '100', 10);
    const maxTotal = parseInt(maxTotalStr ?? '500', 10);

    return this.logQueryStrategy.recentLogs({
      serverIds,
      linesPerServer: Number.isFinite(linesPerServer) ? linesPerServer : 100,
      maxTotal: Number.isFinite(maxTotal) ? maxTotal : 500,
    });
  }
}

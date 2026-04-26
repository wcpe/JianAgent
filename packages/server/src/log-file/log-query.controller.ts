import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Roles } from '../auth/roles.decorator.js';
import { LogQueryStrategyService } from './log-query-strategy.service.js';

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

@Controller('logs')
export class LogQueryController {
  private static readonly WINDOW_MS = 1000;
  private static readonly AGGREGATE_LIMIT = 20;
  private static readonly RECENT_LIMIT = 30;
  private static readonly MAX_QUERY_LENGTH = 256;
  private static readonly MAX_SERVER_IDS = 200;
  private static readonly MAX_LINES_PER_SERVER = 500;
  private static readonly MAX_RECENT_TOTAL = 2000;
  private static readonly MAX_AGGREGATE_TOTAL = 2000;

  constructor(private readonly logQueryStrategy: LogQueryStrategyService) {}
  private readonly requestBuckets = new Map<string, number[]>();

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
    @Req() request?: RequestLike,
  ) {
    const normalizedQuery = query?.trim() ?? '';
    if (normalizedQuery === '') {
      throw new BadRequestException('缺少搜索关键词 q');
    }
    if (normalizedQuery.length > LogQueryController.MAX_QUERY_LENGTH) {
      throw new BadRequestException('搜索关键词过长，请控制在 256 字符以内');
    }

    this.assertRateLimit(this.requestIdentity(request), 'aggregate', LogQueryController.AGGREGATE_LIMIT);

    const serverIds = this.parseServerIds(serverIdsStr);
    const maxPerServer = this.parsePositiveInt(maxPerServerStr, 200, 1, 500, 'maxPerServer');
    const maxTotal = Math.min(
      LogQueryController.MAX_AGGREGATE_TOTAL,
      this.parsePositiveInt(maxTotalStr, 500, 1, LogQueryController.MAX_AGGREGATE_TOTAL, 'maxTotal'),
    );
    const caseSensitive = caseSensitiveStr === 'true';
    const normalizedStartTime = this.parseTime(startTime, 'startTime');
    const normalizedEndTime = this.parseTime(endTime, 'endTime');
    if (normalizedStartTime && normalizedEndTime && Date.parse(normalizedStartTime) > Date.parse(normalizedEndTime)) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }
    const fields = this.parseFields(fieldsStr);

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
    @Query('fields') fieldsStr?: string,
    @Req() request?: RequestLike,
  ) {
    this.assertRateLimit(this.requestIdentity(request), 'recent', LogQueryController.RECENT_LIMIT);

    const serverIds = this.parseServerIds(serverIdsStr);
    const linesPerServer = Math.min(
      LogQueryController.MAX_LINES_PER_SERVER,
      this.parsePositiveInt(linesPerServerStr, 100, 1, LogQueryController.MAX_LINES_PER_SERVER, 'linesPerServer'),
    );
    const maxTotal = Math.min(
      LogQueryController.MAX_RECENT_TOTAL,
      this.parsePositiveInt(maxTotalStr, 500, 1, LogQueryController.MAX_RECENT_TOTAL, 'maxTotal'),
    );
    const fields = this.parseFields(fieldsStr);

    return this.logQueryStrategy.recentLogs({
      serverIds,
      linesPerServer: Number.isFinite(linesPerServer) ? linesPerServer : 100,
      maxTotal: Number.isFinite(maxTotal) ? maxTotal : 500,
      fields,
    });
  }

  private requestIdentity(request?: RequestLike): string {
    const xff = request?.headers?.['x-forwarded-for'];
    if (typeof xff === 'string') {
      return xff.split(',')[0].trim() || 'unknown';
    }
    if (Array.isArray(xff) && xff[0]) {
      return xff[0];
    }
    return request?.ip ?? 'unknown';
  }

  private parseServerIds(serverIdsStr?: string): string[] | undefined {
    if (!serverIdsStr) return undefined;
    const serverIds = Array.from(new Set(
      serverIdsStr
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is string => item.length > 0),
    )).slice(0, LogQueryController.MAX_SERVER_IDS);

    return serverIds;
  }

  private parsePositiveInt(
    raw: string | undefined,
    defaultValue: number,
    min: number,
    max: number,
    field: string,
  ): number {
    const parsed = Number(raw ?? String(defaultValue));
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${field} 必须是整数`);
    }
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${field} 必须在 ${min}~${max} 之间`);
    }
    return parsed;
  }

  private parseTime(raw: string | undefined, field: string): string | undefined {
    if (!raw) return undefined;
    const value = raw.trim();
    if (!value) return undefined;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`${field} 格式无效`);
    }
    return value;
  }

  private parseFields(raw?: string): Array<'content' | 'file'> | undefined {
    if (!raw) return undefined;
    const fields = raw
      .split(',')
      .map((field) => field.trim())
      .filter((field): field is 'content' | 'file' => field === 'content' || field === 'file');
    return fields.length > 0 ? fields : undefined;
  }

  private assertRateLimit(identity: string, scope: string, maxRequests: number): void {
    const key = `${scope}:${identity}`;
    const now = Date.now();
    const window = this.requestBuckets.get(key) ?? [];
    const start = now - LogQueryController.WINDOW_MS;

    const filtered = window.filter((ts) => ts >= start);
    if (filtered.length >= maxRequests) {
      throw new HttpException('请求过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS);
    }

    filtered.push(now);
    this.requestBuckets.set(key, filtered);

    // prevent unbounded growth in long-lived instances
    if (this.requestBuckets.size > 10000) {
      this.requestBuckets.clear();
    }
  }
}

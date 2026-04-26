import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Roles } from '../auth/roles.decorator.js';
import { LogSearchService } from './log-search.service.js';

@Controller('logs/search')
export class LogSearchController {
  constructor(private readonly logSearchService: LogSearchService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  search(
    @Query('q') q?: string,
    @Query('hosts') hostsStr?: string,
    @Query('level') level?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const query = (q ?? '').trim();
    if (!query) {
      throw new BadRequestException('缺少搜索关键词 q');
    }
    if (query.length > 256) {
      throw new BadRequestException('搜索关键词过长，请控制在 256 字符以内');
    }

    const hosts = hostsStr
      ? [...new Set(hostsStr.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 200)
      : undefined;

    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));

    if (startTime && isNaN(Date.parse(startTime))) {
      throw new BadRequestException('startTime 格式无效');
    }
    if (endTime && isNaN(Date.parse(endTime))) {
      throw new BadRequestException('endTime 格式无效');
    }
    if (startTime && endTime && Date.parse(startTime) > Date.parse(endTime)) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }

    return {
      success: true,
      data: this.logSearchService.ftsSearch({
        q: query,
        hosts,
        level,
        startTime,
        endTime,
        page,
        limit,
      }),
    };
  }
}

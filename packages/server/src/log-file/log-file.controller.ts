import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { LogFileService } from './log-file.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('api/servers/:id/log-files')
export class LogFileController {
  constructor(private readonly logFileService: LogFileService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listLogFiles(@Param('id') id: string) {
    return this.logFileService.listLogFiles(id);
  }

  @Get('search')
  @Roles(RoleLevel.VIEWER)
  async searchLogFiles(
    @Param('id') id: string,
    @Query('q') query?: string,
    @Query('files') filesStr?: string,
    @Query('max') maxStr?: string,
  ) {
    if (!query) throw new BadRequestException('缺少搜索关键词 q');
    const files = filesStr ? filesStr.split(',').map((f) => f.trim()).filter(Boolean) : [];
    if (files.length === 0) {
      // Default: search all log files
      const allFiles = await this.logFileService.listLogFiles(id);
      files.push(...allFiles.map((f) => f.name));
    }
    const max = Math.min(500, Math.max(1, parseInt(maxStr ?? '200', 10) || 200));
    return this.logFileService.searchLogFiles(id, query, files, max);
  }

  @Get(':filename')
  @Roles(RoleLevel.VIEWER)
  async readLogFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
  ) {
    const content = await this.logFileService.readLogFile(id, filename);
    return { content };
  }

  @Get(':filename/tail')
  @Roles(RoleLevel.VIEWER)
  async tailLogFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Query('lines') linesStr?: string,
  ) {
    const lines = Math.min(5000, Math.max(1, parseInt(linesStr ?? '200', 10) || 200));
    const content = await this.logFileService.tailLogFile(id, filename, lines);
    return { content };
  }
}

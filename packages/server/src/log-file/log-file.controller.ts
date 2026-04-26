import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { LogFileService } from './log-file.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('servers/:id/log-files')
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
    @Query('level') level?: string,
  ) {
    if (!query) throw new BadRequestException('缺少搜索关键词 q');
    const files = filesStr ? filesStr.split(',').map((f) => f.trim()).filter(Boolean) : [];
    if (files.length === 0) {
      // Default: search all log files
      const allFiles = await this.logFileService.listLogFiles(id);
      files.push(...allFiles.map((f) => f.name));
    }
    const max = Math.min(500, Math.max(1, parseInt(maxStr ?? '200', 10) || 200));
    let results = await this.logFileService.searchLogFiles(id, query, files, max);
    if (level) {
      results = results.filter(r => LogFileService.extractLevel(r.content) === level.toUpperCase());
    }
    return results;
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

  @Get(':filename/export')
  @Roles(RoleLevel.VIEWER)
  async exportLogFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Query('format') format: string = 'txt',
    @Query('levels') levelsStr?: string,
    @Query('keyword') keyword?: string,
  ) {
    const content = await this.logFileService.readLogFile(id, filename);
    let lines = content.split('\n');

    if (levelsStr) {
      const levels = new Set(levelsStr.split(',').map(s => s.trim().toUpperCase()));
      lines = lines.filter(l => levels.has(LogFileService.extractLevel(l)));
    }
    if (keyword) {
      const lower = keyword.toLowerCase();
      lines = lines.filter(l => l.toLowerCase().includes(lower));
    }

    return { success: true, data: { content: lines.join('\n'), filename, format } };
  }
}

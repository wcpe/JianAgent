import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Body,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { DiagnosticFileService, ListFilesQuery } from './diagnostic-file.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import * as fs from 'fs';

@Controller('diagnostic-files')
@UseGuards(JwtGuard, RolesGuard)
export class DiagnosticFileController {
  constructor(private readonly diagnosticFileService: DiagnosticFileService) {}

  @Get()
  async listFiles(@Query() query: ListFilesQuery) {
    const pid = query.pid ? parseInt(query.pid as any, 10) : undefined;
    return this.diagnosticFileService.listFiles({
      ...query,
      pid,
    });
  }

  @Get('stats')
  async getStorageStats() {
    return this.diagnosticFileService.getStorageStats();
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    const file = await this.diagnosticFileService.getFileById(id);
    if (!file) {
      throw new NotFoundException(`File not found: ${id}`);
    }
    return file;
  }

  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.diagnosticFileService.getFileById(id);
    if (!file) {
      throw new NotFoundException(`File not found: ${id}`);
    }

    // 检查文件是否存在
    if (!fs.existsSync(file.filePath)) {
      throw new NotFoundException(`File not found on disk: ${file.filePath}`);
    }

    // 设置响应头
    const fileName = file.filePath.split('/').pop() || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', file.fileSize);

    // 流式传输文件
    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);
  }

  @Delete(':id')
  @Roles(RoleLevel.ADMIN)
  async deleteFile(@Param('id') id: string) {
    await this.diagnosticFileService.deleteFile(id);
    return { success: true, message: 'File deleted successfully' };
  }

  @Delete()
  @Roles(RoleLevel.ADMIN)
  async deleteFiles(@Body() body: { ids: string[] }) {
    await this.diagnosticFileService.deleteFiles(body.ids);
    return { success: true, message: `${body.ids.length} files deleted successfully` };
  }

  @Post('cleanup')
  @Roles(RoleLevel.ADMIN)
  async cleanup(@Body() body: { olderThanDays: number; fileTypes?: string[] }) {
    const deletedCount = await this.diagnosticFileService.cleanup(
      body.olderThanDays,
      body.fileTypes,
    );
    return { success: true, deletedCount, message: `${deletedCount} files cleaned up` };
  }
}

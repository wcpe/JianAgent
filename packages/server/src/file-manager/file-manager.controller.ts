import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileManagerService } from './file-manager.service.js';
import { FileVersionService } from './file-version.service.js';
import { FileTaskService } from './file-task.service.js';
import { FileTaskExecutor } from './file-task.executor.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel, FileTaskKind } from '@jian-agent/shared-domain';
import type { FileTaskRequest } from '@jian-agent/shared-domain';

@Controller('api/servers/:id/files')
@UseGuards(JwtGuard, RolesGuard)
export class FileManagerController {
  constructor(
    private readonly fileManager: FileManagerService,
    private readonly fileVersion: FileVersionService,
    private readonly fileTaskService: FileTaskService,
    private readonly fileTaskExecutor: FileTaskExecutor,
  ) {}

  // ── Sync short operations ──

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listDir(@Param('id') id: string, @Query('path') path = '') {
    return this.fileManager.listDir(id, path);
  }

  @Get('content')
  @Roles(RoleLevel.VIEWER)
  async readFile(@Param('id') id: string, @Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    return this.fileManager.readFile(id, path);
  }

  @Put('content')
  @Roles(RoleLevel.DANGER)
  @Auditable('file:write')
  async writeFile(
    @Param('id') id: string,
    @Body() body: { path: string; content: string },
    @Req() req: any,
  ) {
    if (!body.path) throw new BadRequestException('path is required');
    await this.fileManager.writeFile(id, body.path, body.content);
    const userId = req.user?.sub ?? '';
    this.fileVersion.createVersion(id, body.path, body.content, userId, 'manual');
    return { success: true };
  }

  @Delete()
  @Roles(RoleLevel.DANGER)
  @Auditable('file:delete')
  async deleteEntry(@Param('id') id: string, @Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    await this.fileManager.deleteEntry(id, path);
    return { success: true };
  }

  @Post('mkdir')
  @Roles(RoleLevel.DANGER)
  @Auditable('file:mkdir')
  async mkdir(@Param('id') id: string, @Body() body: { path: string }) {
    if (!body.path) throw new BadRequestException('path is required');
    await this.fileManager.mkdir(id, body.path);
    return { success: true };
  }

  @Post('rename')
  @Roles(RoleLevel.DANGER)
  @Auditable('file:rename')
  async rename(
    @Param('id') id: string,
    @Body() body: { oldPath: string; newPath: string },
  ) {
    if (!body.oldPath || !body.newPath) throw new BadRequestException('oldPath and newPath are required');
    await this.fileManager.rename(id, body.oldPath, body.newPath);
    return { success: true };
  }

  // ── Async long operations (return taskId) ──

  @Post('tasks')
  @Roles(RoleLevel.DANGER)
  @Auditable('file:task')
  async createTask(
    @Param('id') id: string,
    @Body() body: FileTaskRequest,
  ) {
    switch (body.kind) {
      case FileTaskKind.UPLOAD: {
        const data = Buffer.from(body.data, 'base64');
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.UPLOAD,
          sourcePaths: [body.filename],
          targetPath: body.dirPath,
        });
        // Execute upload in background
        void this.fileTaskService.markRunning(task.taskId).then(async () => {
          try {
            await this.fileManager.uploadFile(id, body.dirPath, data, body.filename);
            await this.fileTaskService.markCompleted(
              task.taskId,
              body.dirPath ? `${body.dirPath}/${body.filename}` : body.filename,
            );
          } catch (err: any) {
            await this.fileTaskService.markFailed(task.taskId, err.message, err.stack);
          }
        });
        return { taskId: task.taskId };
      }

      case FileTaskKind.PACK_DOWNLOAD: {
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.PACK_DOWNLOAD,
          sourcePaths: body.paths,
        });
        return { taskId: task.taskId };
      }

      case FileTaskKind.DIR_COPY: {
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.DIR_COPY,
          sourcePaths: [body.sourcePath],
          targetPath: body.destPath,
        });
        return { taskId: task.taskId };
      }

      case FileTaskKind.DIR_MOVE: {
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.DIR_MOVE,
          sourcePaths: [body.sourcePath],
          targetPath: body.destPath,
        });
        return { taskId: task.taskId };
      }

      case FileTaskKind.COMPRESS: {
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.COMPRESS,
          sourcePaths: body.sourcePaths,
          targetPath: body.archivePath,
        });
        return { taskId: task.taskId };
      }

      case FileTaskKind.DECOMPRESS: {
        const task = await this.fileTaskExecutor.submit({
          serverId: id,
          kind: FileTaskKind.DECOMPRESS,
          sourcePaths: [body.archivePath],
          targetPath: body.destDir,
        });
        return { taskId: task.taskId };
      }

      default:
        throw new BadRequestException('Unknown task kind');
    }
  }

  // ── Task management endpoints ──

  @Get('tasks')
  @Roles(RoleLevel.VIEWER)
  async listTasks(@Param('id') id: string) {
    return this.fileTaskService.listTasks(id);
  }

  @Get('tasks/:taskId')
  @Roles(RoleLevel.VIEWER)
  async getTask(@Param('taskId') taskId: string) {
    return this.fileTaskService.getTask(taskId);
  }

  @Post('tasks/:taskId/cancel')
  @Roles(RoleLevel.DANGER)
  async cancelTask(@Param('taskId') taskId: string) {
    await this.fileTaskExecutor.cancel(taskId);
    return { success: true };
  }

  @Get('tasks/:taskId/artifact')
  @Roles(RoleLevel.VIEWER)
  async downloadArtifact(@Param('taskId') taskId: string) {
    const artifact = await this.fileTaskService.getArtifactBuffer(taskId);
    if (!artifact) throw new NotFoundException('Artifact not available');
    return {
      filename: artifact.filename,
      data: artifact.data.toString('base64'),
      size: artifact.data.length,
    };
  }

  // ── Legacy single-file download (sync) ──

  @Get('download')
  @Roles(RoleLevel.VIEWER)
  async downloadFile(@Param('id') id: string, @Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    const buf = await this.fileManager.downloadFile(id, path);
    const filename = path.split('/').pop() ?? 'download';
    return {
      filename,
      data: buf.toString('base64'),
      size: buf.length,
    };
  }

  // ── File Versions ──

  @Get('versions')
  @Roles(RoleLevel.VIEWER)
  listVersions(@Param('id') id: string, @Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    return this.fileVersion.listVersions(id, path);
  }

  @Get('versions/:vid')
  @Roles(RoleLevel.VIEWER)
  getVersion(@Param('vid') vid: string) {
    const v = this.fileVersion.getVersion(vid);
    if (!v) throw new BadRequestException('Version not found');
    return v;
  }

  @Post('versions/:vid/restore')
  @Roles(RoleLevel.DANGER)
  @Auditable('file:restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('vid') vid: string,
    @Req() req: any,
  ) {
    const v = this.fileVersion.getVersion(vid);
    if (!v) throw new BadRequestException('Version not found');
    await this.fileManager.writeFile(id, v.filePath, v.content);
    const userId = req.user?.sub ?? '';
    this.fileVersion.createVersion(id, v.filePath, v.content, userId, 'manual');
    return { success: true };
  }

  @Post('versions/auto')
  @Roles(RoleLevel.VIEWER)
  autoSaveVersion(
    @Param('id') id: string,
    @Body() body: { path: string; content: string },
    @Req() req: any,
  ) {
    if (!body.path) throw new BadRequestException('path is required');
    const userId = req.user?.sub ?? '';
    const versionId = this.fileVersion.createVersion(id, body.path, body.content, userId, 'auto');
    return { success: true, versionId };
  }
}
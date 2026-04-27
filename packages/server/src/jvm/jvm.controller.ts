import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus, Res, StreamableFile, Req } from '@nestjs/common';
import { JvmService } from './jvm.service';
import { Roles } from '../auth/roles.decorator';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('jvm')
export class JvmController {
  constructor(
    private readonly jvmService: JvmService,
    private readonly auditService: AuditService,
  ) {}

  @Get('processes')
  @Roles(RoleLevel.VIEWER)
  async listProcesses() {
    try {
      const processes = await this.jvmService.listJavaProcesses();
      return { success: true, data: processes };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('attach/:pid')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async attach(@Param('pid') pid: string) {
    try {
      const result = await this.jvmService.attachToProcess(pid);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Delete('detach')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async detach() {
    try {
      const result = await this.jvmService.detachFromProcess();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('threads')
  @Roles(RoleLevel.VIEWER)
  async sampleThreads() {
    try {
      const result = await this.jvmService.sampleThreads();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('heap')
  @Roles(RoleLevel.VIEWER)
  async sampleHeap() {
    try {
      const result = await this.jvmService.sampleHeap();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('status')
  @Roles(RoleLevel.VIEWER)
  async getStatus() {
    try {
      const result = await this.jvmService.getStatus();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('heap-dump')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async generateHeapDump(@Body() body: { outputPath: string; liveObjectsOnly?: boolean }) {
    try {
      const result = await this.jvmService.generateHeapDump(body.outputPath, body.liveObjectsOnly ?? true);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('thread-dump')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async generateThreadDump(@Body() body: { 
    outputPath: string; 
    includeLockedMonitors?: boolean; 
    includeLockedSynchronizers?: boolean;
  }) {
    try {
      const result = await this.jvmService.generateThreadDump(
        body.outputPath, 
        body.includeLockedMonitors ?? true,
        body.includeLockedSynchronizers ?? true
      );
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('dumps')
  @Roles(RoleLevel.VIEWER)
  async listDumps() {
    try {
      const dumpsDir = resolve(process.cwd(), 'data', 'dumps');
      if (!existsSync(dumpsDir)) {
        return { success: true, data: [] };
      }

      const files = await readdir(dumpsDir);
      const dumps = await Promise.all(
        files
          .filter(f => f.endsWith('.hprof') || f.endsWith('.txt'))
          .map(async (filename) => {
            const filePath = join(dumpsDir, filename);
            const stats = await stat(filePath);
            return {
              filename,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              type: filename.endsWith('.hprof') ? 'heap' : 'thread',
            };
          })
      );

      return { success: true, data: dumps };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('dumps/:filename')
  @Roles(RoleLevel.OPERATOR)
  async downloadDump(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    try {
      const dumpsDir = resolve(process.cwd(), 'data', 'dumps');
      const filePath = join(dumpsDir, filename);

      if (!existsSync(filePath)) {
        res.status(404);
        return { success: false, error: 'File not found' };
      }

      const stats = await stat(filePath);
      const stream = createReadStream(filePath);

      res.set({
        'Content-Type': filename.endsWith('.hprof') ? 'application/octet-stream' : 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size,
      });

      return new StreamableFile(stream);
    } catch (err) {
      res.status(500);
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('check-disk-space')
  @Roles(RoleLevel.VIEWER)
  @HttpCode(HttpStatus.OK)
  async checkDiskSpace(@Body() body: { path: string }) {
    try {
      const result = await this.jvmService.checkDiskSpace(body.path);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('estimate-heap-size')
  @Roles(RoleLevel.VIEWER)
  async estimateHeapSize() {
    try {
      const result = await this.jvmService.estimateHeapSize();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('jfr/start')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async startJfr(@Body() body: { name?: string; durationSeconds?: number; maxSize?: number; maxAge?: number }) {
    try {
      const result = await this.jvmService.startJfrRecording(body);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('jfr/stop')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async stopJfr(@Body() body: { recordingId: number; outputPath: string }) {
    try {
      const result = await this.jvmService.stopJfrRecording(body.recordingId, body.outputPath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('jfr/status/:recordingId')
  @Roles(RoleLevel.VIEWER)
  async getJfrStatus(@Param('recordingId') recordingId: string) {
    try {
      const result = await this.jvmService.getJfrStatus(parseInt(recordingId, 10));
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('info/flags')
  @Roles(RoleLevel.VIEWER)
  async getJvmFlags() {
    try {
      const result = await this.jvmService.getJvmFlags();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('info/class-loading')
  @Roles(RoleLevel.VIEWER)
  async getClassLoading() {
    try {
      const result = await this.jvmService.getClassLoadingInfo();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Get('info/gc')
  @Roles(RoleLevel.VIEWER)
  async getGcInfo() {
    try {
      const result = await this.jvmService.getGcInfo();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('cpu-sampling')
  @Roles(RoleLevel.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async startCpuSampling(@Body() body: { durationSeconds?: number; intervalMs?: number }) {
    try {
      const result = await this.jvmService.startCpuSampling(body);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  @Post('shutdown/:pid')
  @Roles(RoleLevel.ADMIN)
  @HttpCode(HttpStatus.OK)
  async shutdown(
    @Param('pid') pid: string,
    @Body() body: { graceful: boolean; timeout?: number },
    @Req() req: AuthenticatedRequest & { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';
    let processName = 'Unknown';

    try {
      // 获取进程名称用于审计日志
      try {
        const processes = await this.jvmService.listJavaProcesses();
        const process = processes.find(p => p.pid === parseInt(pid, 10));
        processName = process?.name || `Process ${pid}`;
      } catch (err) {
        // 忽略获取进程名称的错误
      }

      // 执行关闭操作
      const result = await this.jvmService.shutdownJvm(pid, body.graceful, body.timeout);
      success = true;

      // 记录审计日志
      if (req.user) {
        const ip = req.ip ?? (req.headers?.['x-forwarded-for'] as string) ?? 'unknown';
        await this.auditService.record({
          userId: req.user.sub,
          username: req.user.username,
          operation: 'jvm:shutdown',
          target: `pid:${pid} (${processName})`,
          params: JSON.stringify({ graceful: body.graceful, timeout: body.timeout }),
          success: true,
          ip,
        });
      }

      return { 
        success: true, 
        message: `Process ${pid} shutdown initiated successfully`,
        data: result,
      };
    } catch (err) {
      success = false;
      errorMessage = (err as Error).message;

      // 记录失败的审计日志
      if (req.user) {
        const ip = req.ip ?? (req.headers?.['x-forwarded-for'] as string) ?? 'unknown';
        await this.auditService.record({
          userId: req.user.sub,
          username: req.user.username,
          operation: 'jvm:shutdown',
          target: `pid:${pid} (${processName})`,
          params: JSON.stringify({ graceful: body.graceful, timeout: body.timeout }),
          success: false,
          ip,
        });
      }

      return { 
        success: false, 
        message: `Failed to shutdown process ${pid}: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }
}

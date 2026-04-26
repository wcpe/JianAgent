import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { Res } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { JvmCapabilityFacade } from './jvm-capability.facade.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

interface StreamReply {
  header(name: string, value: string): this;
  send(payload: NodeJS.ReadableStream): this;
}

@Controller('java-helper')
@UseGuards(JwtGuard, RolesGuard)
export class JavaHelperController {
  constructor(
    private readonly jvmFacade: JvmCapabilityFacade,
  ) {}

  @Get('status')
  @Roles(RoleLevel.VIEWER)
  async getStatus() {
    return { success: true, data: await this.jvmFacade.getStatus() };
  }

  @Post('start')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.start')
  async start() {
    await this.jvmFacade.startHelper();
    return { success: true };
  }

  @Post('resolve')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.resolve')
  async resolve() {
    const data = await this.jvmFacade.resolveHelper();
    return { success: true, data };
  }

  @Post('scan-jar')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.scan-jar')
  async scanJar(@Body() body: { jarPath: string }) {
    const data = await this.jvmFacade.scanJar(body.jarPath);
    return { success: true, data };
  }

  @Get('entry-classes')
  @Roles(RoleLevel.VIEWER)
  async getEntryClasses(@Query('jarPath') jarPath: string) {
    const data = await this.jvmFacade.scanJar(jarPath);
    return { success: true, data };
  }

  @Post('recommend-jvm-args')
  @Roles(RoleLevel.VIEWER)
  async recommendJvmArgs(@Body() body: { jarPath: string; maxMemoryMb?: number }) {
    const data = await this.jvmFacade.recommendJvmArgs(body.jarPath, body.maxMemoryMb);
    return { success: true, data };
  }

  @Post('attach')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.attach')
  async attach(@Body() body: { pid: string }) {
    const data = await this.jvmFacade.attachToTarget({ pid: body.pid });
    return { success: true, data };
  }

  @Post('sample')
  @Roles(RoleLevel.DANGER)
  async sample(@Body() body: { kind: 'thread' | 'heap' }) {
    const data = body.kind === 'thread'
      ? await this.jvmFacade.sampleThreads()
      : await this.jvmFacade.sampleHeap();
    return { success: true, data };
  }

  @Post('detach')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.detach')
  async detach() {
    await this.jvmFacade.detachFromTarget();
    return { success: true };
  }

  @Post('jfr/start')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.jfr.start')
  async startJfr(
    @Body() body: { serverId: string; pid: string; durationSec?: number; settings?: 'default' | 'profile' },
  ) {
    const data = await this.jvmFacade.startJfrTask(body);
    return { success: true, data };
  }

  @Post('jfr/stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('java-helper.jfr.stop')
  async stopJfr(@Body() body: { taskId: string }) {
    const data = await this.jvmFacade.stopJfrTask(body.taskId);
    return { success: true, data };
  }

  @Get('jfr/tasks')
  @Roles(RoleLevel.VIEWER)
  async listJfrTasks(@Query('serverId') serverId?: string) {
    const data = await this.jvmFacade.listJfrTasks(serverId);
    return { success: true, data };
  }

  @Get('jfr/task')
  @Roles(RoleLevel.VIEWER)
  async getJfrTask(@Query('taskId') taskId: string) {
    const data = await this.jvmFacade.getJfrTask(taskId);
    return { success: true, data: data ?? null };
  }

  @Get('jfr/download')
  @Roles(RoleLevel.VIEWER)
  async downloadJfr(@Query('taskId') taskId: string) {
    const data = await this.jvmFacade.getJfrDownloadPayload(taskId);
    return { success: true, data };
  }

  @Get('jfr/download-stream')
  @Roles(RoleLevel.VIEWER)
  @Auditable('java-helper.jfr.download-stream')
  async downloadJfrStream(
    @Query('taskId') taskId: string,
    @Res({ passthrough: false }) reply: StreamReply,
  ) {
    const data = await this.jvmFacade.getJfrDownloadStreamMeta(taskId);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Length', String(data.sizeBytes));
    reply.header('Content-Disposition', `attachment; filename="${data.fileName}"`);
    return reply.send(createReadStream(data.filePath));
  }

  @Post('jfr/cleanup')
  @Roles(RoleLevel.ADMIN)
  @Auditable('java-helper.jfr.cleanup')
  async cleanupJfr(@Body() body: { retentionDays?: number }) {
    const retentionDays = body.retentionDays ?? 7;
    const data = await this.jvmFacade.cleanupJfrTasks(retentionDays);
    return { success: true, data };
  }
}

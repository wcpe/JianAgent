import { Controller, Get, Post, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { JvmService } from './jvm.service';
import { Roles } from '../auth/roles.decorator';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('jvm')
export class JvmController {
  constructor(private readonly jvmService: JvmService) {}

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
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackupService } from './backup.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type { CreateBackupRequest, UpdateBackupScheduleRequest } from '@jian-agent/shared-domain';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('servers/:id/backups')
@UseGuards(JwtGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listBackups(@Param('id') serverId: string) {
    return this.backupService.listBackups(serverId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleLevel.DANGER)
  @Auditable('backup:create')
  async createBackup(
    @Param('id') serverId: string,
    @Body() body: CreateBackupRequest,
  ) {
    return this.backupService.createBackup(serverId, body);
  }

  @Get(':backupId/download')
  @Roles(RoleLevel.VIEWER)
  async downloadBackup(
    @Param('id') serverId: string,
    @Param('backupId') backupId: string,
  ) {
    const { buffer, fileName } = await this.backupService.getBackupFile(serverId, backupId);
    return { filename: fileName, data: buffer.toString('base64'), size: buffer.length };
  }

  @Delete(':backupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleLevel.DANGER)
  @Auditable('backup:delete')
  async deleteBackup(
    @Param('id') serverId: string,
    @Param('backupId') backupId: string,
  ): Promise<void> {
    await this.backupService.deleteBackup(serverId, backupId);
  }

  @Get('schedule')
  @Roles(RoleLevel.VIEWER)
  async getSchedule(@Param('id') serverId: string) {
    return this.backupService.getSchedule(serverId);
  }

  @Put('schedule')
  @Roles(RoleLevel.DANGER)
  @Auditable('backup:schedule')
  async updateSchedule(
    @Param('id') serverId: string,
    @Body() body: UpdateBackupScheduleRequest,
  ) {
    return this.backupService.updateSchedule(serverId, body);
  }
}

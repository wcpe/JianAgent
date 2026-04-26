import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type { CreateNotificationChannelRequest, UpdateNotificationChannelRequest } from '@jian-agent/shared-domain';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('notification-channels')
@UseGuards(JwtGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listChannels() {
    return this.notificationService.listChannels();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleLevel.ADMIN)
  @Auditable('notification:create')
  async createChannel(@Body() body: CreateNotificationChannelRequest) {
    return this.notificationService.createChannel(body);
  }

  @Patch(':id')
  @Roles(RoleLevel.ADMIN)
  @Auditable('notification:update')
  async updateChannel(
    @Param('id') id: string,
    @Body() body: UpdateNotificationChannelRequest,
  ) {
    return this.notificationService.updateChannel(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleLevel.ADMIN)
  @Auditable('notification:delete')
  async deleteChannel(@Param('id') id: string): Promise<void> {
    await this.notificationService.deleteChannel(id);
  }

  @Post(':id/test')
  @Roles(RoleLevel.ADMIN)
  async testChannel(@Param('id') id: string) {
    return this.notificationService.testChannel(id);
  }
}

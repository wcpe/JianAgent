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
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import type {
  CreateRemoteHostRequest,
  UpdateRemoteHostRequest,
} from '@jian-agent/shared-domain';
import { RemoteHostService } from './remote-host.service.js';
import { PlatformResourceService } from '../platform-resource/platform-resource.service.js';

@Controller('remote-hosts')
@UseGuards(JwtGuard, RolesGuard)
export class RemoteHostController {
  constructor(
    private readonly remoteHostService: RemoteHostService,
    private readonly platformResourceService: PlatformResourceService,
  ) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async list() {
    return this.remoteHostService.list();
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  async getById(@Param('id') id: string) {
    return this.platformResourceService.getDetailById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleLevel.ADMIN)
  @Auditable('remote-host:create')
  async create(@Body() body: CreateRemoteHostRequest) {
    return this.remoteHostService.create(body);
  }

  @Post('test-connection-preview')
  @Roles(RoleLevel.OPERATOR)
  async testConnectionPreview(@Body() body: CreateRemoteHostRequest) {
    return this.remoteHostService.testConnectionPreview(body);
  }

  @Patch(':id')
  @Roles(RoleLevel.ADMIN)
  @Auditable('remote-host:update')
  async update(@Param('id') id: string, @Body() body: UpdateRemoteHostRequest) {
    return this.remoteHostService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleLevel.ADMIN)
  @Auditable('remote-host:delete')
  async delete(@Param('id') id: string): Promise<void> {
    await this.remoteHostService.delete(id);
  }

  @Post(':id/test')
  @Roles(RoleLevel.OPERATOR)
  @Auditable('remote-host:test-connection')
  async testConnection(@Param('id') id: string) {
    return this.remoteHostService.testConnection(id);
  }

  @Post(':id/ssh-connect')
  @Roles(RoleLevel.OPERATOR)
  @Auditable('remote-host:ssh-connect')
  async sshConnect(@Param('id') id: string) {
    const row = await this.remoteHostService.getById(id);
    const config = this.remoteHostService.toSshConfig(row);
    // Return the SSH config so the client can initiate a WebSocket SSH session
    return {
      hostId: id,
      sshConfig: config,
    };
  }
}

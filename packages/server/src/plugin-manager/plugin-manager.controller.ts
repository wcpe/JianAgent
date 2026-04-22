import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('api/servers/:id/plugins')
@UseGuards(JwtGuard, RolesGuard)
export class PluginManagerController {
  constructor(private readonly pluginManager: PluginManagerService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listPlugins(@Param('id') id: string) {
    return this.pluginManager.listPlugins(id);
  }

  @Post('upload')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:upload')
  async uploadPlugin(@Param('id') id: string, @Body() body: { filename: string; data: string }) {
    if (!body.filename || !body.data) {
      throw new BadRequestException('filename and data (base64) are required');
    }
    const buf = Buffer.from(body.data, 'base64');
    await this.pluginManager.uploadPlugin(id, buf, body.filename);
    return { success: true };
  }

  @Delete(':name')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:delete')
  async deletePlugin(@Param('id') id: string, @Param('name') name: string) {
    await this.pluginManager.deletePlugin(id, name);
    return { success: true };
  }

  @Post(':name/enable')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:enable')
  async enablePlugin(@Param('id') id: string, @Param('name') name: string) {
    return this.pluginManager.enablePlugin(id, name);
  }

  @Post(':name/disable')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:disable')
  async disablePlugin(@Param('id') id: string, @Param('name') name: string) {
    return this.pluginManager.disablePlugin(id, name);
  }

  @Post(':name/hot-load')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:hot-load')
  async hotLoadPlugin(@Param('id') id: string, @Param('name') name: string) {
    return this.pluginManager.hotLoadPlugin(id, name);
  }

  @Post(':name/hot-unload')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:hot-unload')
  async hotUnloadPlugin(@Param('id') id: string, @Param('name') name: string) {
    return this.pluginManager.hotUnloadPlugin(id, name);
  }

  @Post(':name/hot-reload')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:hot-reload')
  async hotReloadPlugin(@Param('id') id: string, @Param('name') name: string) {
    return this.pluginManager.hotReloadPlugin(id, name);
  }

  @Post(':name/replace')
  @Roles(RoleLevel.DANGER)
  @Auditable('plugin:replace-version')
  async replacePluginVersion(
    @Param('id') id: string,
    @Param('name') name: string,
    @Body() body: { filename: string; data: string; hotSwap?: boolean },
  ) {
    if (!body.filename || !body.data) {
      throw new BadRequestException('filename and data (base64) are required');
    }
    const buf = Buffer.from(body.data, 'base64');
    return this.pluginManager.replacePluginVersion(id, name, buf, body.filename, body.hotSwap ?? true);
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { PlatformResourceService } from './platform-resource.service.js';

@Controller('api/resources')
@UseGuards(JwtGuard, RolesGuard)
export class PlatformResourceController {
  constructor(
    private readonly platformResourceService: PlatformResourceService,
  ) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listResources(
    @Query('kind') kind?: string,
    @Query('serverType') serverType?: 'managed' | 'external',
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('group') group?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platformResourceService.listWorkspace({
      kind,
      serverType,
      status,
      q,
      group,
      tag,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  async getDetail(@Param('id') id: string) {
    return this.platformResourceService.getDetailById(id);
  }

  @Get(':id/capabilities')
  @Roles(RoleLevel.VIEWER)
  async getCapabilities(@Param('id') id: string) {
    return this.platformResourceService.getCapabilitiesById(id);
  }
}

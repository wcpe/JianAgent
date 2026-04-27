import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { RoleLevel } from '@jian-agent/shared-domain';
import { Auditable } from '../audit/auditable.decorator.js';
import { ResourceWorkspaceService } from './resource-workspace.service.js';
import type {
  ResourceWorkspaceConfig,
  CreateResourceWorkspaceRequest,
  UpdateResourceWorkspaceRequest,
  QuickProvisionRequest,
  ProvisionServerResponse,
} from '@jian-agent/shared-domain';

@Controller('resource-workspaces')
export class ResourceWorkspaceController {
  constructor(private readonly service: ResourceWorkspaceService) {}

  @Get()
  async findAll(): Promise<readonly ResourceWorkspaceConfig[]> {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResourceWorkspaceConfig> {
    return this.service.findOne(id);
  }

  @Post()
  @Auditable('resource-workspace.create')
  async create(@Body() body: CreateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    return this.service.create(body);
  }

  @Put(':id')
  @Auditable('resource-workspace.update')
  async update(@Param('id') id: string, @Body() body: UpdateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Auditable('resource-workspace.delete')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }

  @Get(':id/servers')
  async listServers(@Param('id') id: string): Promise<readonly string[]> {
    return this.service.listServersInWorkspace(id);
  }

  @Post('quick-provision')
  @Auditable('resource-workspace.quick-provision')
  async quickProvision(@Body() body: QuickProvisionRequest): Promise<ProvisionServerResponse> {
    return this.service.quickProvision(body);
  }
}

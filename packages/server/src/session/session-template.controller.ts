import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionTemplateService } from './session-template.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('session-templates')
@UseGuards(JwtGuard, RolesGuard)
export class SessionTemplateController {
  constructor(private readonly templateService: SessionTemplateService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async list() {
    const data = await this.templateService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  async getById(@Param('id') id: string) {
    const data = await this.templateService.findById(id);
    if (!data) return { success: false, error: 'Template not found' };
    return { success: true, data };
  }

  @Post()
  @Roles(RoleLevel.TESTER)
  @Auditable('session-template:create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: { name: string; description?: string; botConfig: Record<string, unknown>; phases: Record<string, unknown>[] }) {
    const data = await this.templateService.create(body);
    return { success: true, data };
  }

  @Put(':id')
  @Roles(RoleLevel.TESTER)
  @Auditable('session-template:update')
  async update(@Param('id') id: string, @Body() body: { name?: string; description?: string; botConfig?: Record<string, unknown>; phases?: Record<string, unknown>[] }) {
    const data = await this.templateService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles(RoleLevel.TESTER)
  @Auditable('session-template:delete')
  async delete(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { success: true };
  }
}

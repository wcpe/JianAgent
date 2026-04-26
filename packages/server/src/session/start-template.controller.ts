import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { StartTemplateService } from './start-template.service.js';
import type { StartTemplateDto, CreateStartTemplateDto, UpdateStartTemplateDto } from '@jian-agent/shared-domain';

@Controller('start-templates')
@UseGuards(JwtGuard, RolesGuard)
export class StartTemplateController {
  constructor(private readonly service: StartTemplateService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  async findAll(): Promise<readonly StartTemplateDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  async findById(@Param('id') id: string): Promise<StartTemplateDto> {
    const result = await this.service.findById(id);
    if (!result) throw new NotFoundException(`Start template not found: ${id}`);
    return result;
  }

  @Post()
  @Roles(RoleLevel.ADMIN)
  @Auditable('template.create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateStartTemplateDto): Promise<StartTemplateDto> {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(RoleLevel.ADMIN)
  @Auditable('template.update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStartTemplateDto,
  ): Promise<StartTemplateDto> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(RoleLevel.ADMIN)
  @Auditable('template.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}

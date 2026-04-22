import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BehaviorTemplateService } from './behavior-template.service.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type { CreateBehaviorTemplateDto, UpdateBehaviorTemplateDto } from '@jian-agent/shared-domain';

@Controller('api/behavior-templates')
export class BehaviorTemplateController {
  constructor(private readonly templateService: BehaviorTemplateService) {}

  @Post()
  @Auditable('bot:create-behavior-template')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateBehaviorTemplateDto) {
    if (!body.name || !body.steps?.length) {
      throw new HttpException('Missing name or steps', HttpStatus.BAD_REQUEST);
    }
    const template = await this.templateService.create(body);
    return { success: true, data: template };
  }

  @Get()
  async findAll() {
    const templates = await this.templateService.findAll();
    return { success: true, data: templates };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const template = await this.templateService.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return { success: true, data: template };
  }

  @Patch(':id')
  @Auditable('bot:update-behavior-template')
  async update(@Param('id') id: string, @Body() body: UpdateBehaviorTemplateDto) {
    const template = await this.templateService.update(id, body);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return { success: true, data: template };
  }

  @Delete(':id')
  @Auditable('bot:delete-behavior-template')
  async remove(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { success: true };
  }
}

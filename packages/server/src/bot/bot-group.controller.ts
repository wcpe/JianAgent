import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BotGroupService } from './bot-group.service.js';
import { BehaviorTemplateService } from './behavior-template.service.js';
import { BotOrchestratorService } from './bot-orchestrator.service.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type {
  CreateBotGroupRequestDto,
  ModifyBotGroupRequestDto,
  ApplyBehaviorToGroupDto,
} from '@jian-agent/shared-domain';

@Controller('api/bot/groups')
export class BotGroupController {
  constructor(
    private readonly groupService: BotGroupService,
    private readonly templateService: BehaviorTemplateService,
    private readonly orchestrator: BotOrchestratorService,
  ) {}

  @Post()
  @Auditable('bot:create-managed-group')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateBotGroupRequestDto) {
    if (!body.name || !body.sessionId) {
      throw new HttpException('Missing name or sessionId', HttpStatus.BAD_REQUEST);
    }
    const group = await this.groupService.createGroup(
      body.sessionId,
      body.name,
      body.botNames ?? [],
    );
    return { success: true, data: group };
  }

  @Get()
  async list(@Query('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException('Missing sessionId query param', HttpStatus.BAD_REQUEST);
    }
    const groups = await this.groupService.listGroups(sessionId);
    return { success: true, data: groups };
  }

  @Patch(':id/add')
  @Auditable('bot:group-add')
  async addBots(@Param('id') id: string, @Body() body: ModifyBotGroupRequestDto) {
    const group = await this.groupService.addToGroup(id, body.botNames ?? []);
    if (!group) throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    return { success: true, data: group };
  }

  @Patch(':id/remove')
  @Auditable('bot:group-remove')
  async removeBots(@Param('id') id: string, @Body() body: ModifyBotGroupRequestDto) {
    const group = await this.groupService.removeFromGroup(id, body.botNames ?? []);
    if (!group) throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    return { success: true, data: group };
  }

  @Delete(':id')
  @Auditable('bot:group-delete')
  async remove(@Param('id') id: string) {
    await this.groupService.deleteGroup(id);
    return { success: true };
  }

  @Post(':id/apply-behavior')
  @Auditable('bot:group-apply-behavior')
  async applyBehavior(
    @Param('id') id: string,
    @Body() body: ApplyBehaviorToGroupDto,
  ) {
    if (!body.templateId) {
      throw new HttpException('Missing templateId', HttpStatus.BAD_REQUEST);
    }
    await this.templateService.applyToGroup(body.templateId, id);
    return { success: true };
  }
}

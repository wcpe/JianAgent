import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WhitelistActionService } from './whitelist-action.service.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type { WhitelistActionRequest, WhitelistActionResult } from '@jian-agent/shared-domain';

@Controller('api/plugin-bridge')
export class WhitelistActionController {
  constructor(private readonly actionService: WhitelistActionService) {}

  @Post('whitelist-action/:serverId')
  @Auditable('plugin:whitelist-action')
  async executeAction(
    @Param('serverId') serverId: string,
    @Body() body: WhitelistActionRequest,
  ): Promise<{ success: boolean; data: WhitelistActionResult }> {
    if (!body.action || typeof body.action !== 'string') {
      throw new HttpException('Missing or invalid action name', HttpStatus.BAD_REQUEST);
    }

    const result = await this.actionService.execute(serverId, body);
    return { success: result.success, data: result };
  }

  @Get('whitelist-actions')
  listActions(): { success: true; data: readonly string[] } {
    return { success: true, data: this.actionService.listAllowedActions() };
  }
}

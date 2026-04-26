import { Controller, Get, Post, Delete, Put, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { BotOrchestratorService } from './bot-orchestrator.service';
import { BotStateService } from './bot-state.service';
import { SavedBotConfigService, type CreateSavedBotConfigDto } from './saved-bot-config.service';
import { CreateBotGroupDto } from './dto/create-bot-group.dto';
import { SetBehaviorDto } from './dto/set-behavior.dto';
import { Auditable } from '../audit/auditable.decorator';
import type { BotScript } from '@jian-agent/shared-protocol';

@Controller('bots')
export class BotController {
  constructor(
    private readonly orchestrator: BotOrchestratorService,
    private readonly stateService: BotStateService,
    private readonly savedBotConfig: SavedBotConfigService,
  ) {}

  @Get()
  list(
    @Query('serverId') serverId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    let bots = [...this.orchestrator.enrichedBots()];
    if (serverId) bots = bots.filter((b) => b.serverId === serverId);
    if (status) bots = bots.filter((b) => b.state === status);
    if (search) {
      const q = search.toLowerCase();
      bots = bots.filter((b) => b.name.toLowerCase().includes(q));
    }
    const total = bots.length;
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const paged = bots.slice((p - 1) * l, p * l);
    return { success: true, data: paged, meta: { total, page: p, limit: l } };
  }

  @Get('stats')
  stats(@Query('serverId') serverId?: string) {
    return { success: true, data: this.orchestrator.getStats(serverId) };
  }

  @Get(':name')
  getOne(@Param('name') name: string) {
    const bot = this.stateService.getBot(name);
    if (!bot) return { success: false, error: 'Bot not found' };
    return { success: true, data: bot };
  }

  @Get(':name/detail')
  async getBotDetail(@Param('name') name: string) {
    const detail = await this.orchestrator.getBotDetail(name);
    return { success: true, data: detail };
  }

  @Post('create')
  @Auditable('bot:create-batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(@Body() dto: CreateBotGroupDto) {
    const result = await this.orchestrator.createBotBatch({
      serverId: dto.serverId,
      namePrefix: dto.namePrefix,
      count: dto.count,
      behavior: dto.behavior ?? 'idle',
      autoRespawn: dto.autoRespawn ?? true,
    });
    return { success: true, data: result };
  }

  @Post('behavior')
  @Auditable('bot:set-behavior')
  setBehavior(@Body() dto: SetBehaviorDto) {
    const ok = this.orchestrator.setBehavior(dto.botName, dto.behavior, dto.params ?? {});
    return { success: ok };
  }

  @Post('stop-batch')
  @Auditable('bot:stop-batch')
  stopBatch(@Body() body: { batchId: string }) {
    this.orchestrator.stopBatch(body.batchId);
    return { success: true };
  }

  @Post('stop-all')
  @Auditable('bot:stop-all')
  stopAll() {
    this.orchestrator.stopAll();
    return { success: true };
  }

  @Delete(':name')
  @Auditable('bot:stop')
  stop(@Param('name') name: string) {
    this.orchestrator.stopBots([name]);
    this.stateService.removeStopped(name);
    return { success: true };
  }

  @Post(':name/debug/start')
  @Auditable('bot:debug-start')
  startDebug(@Param('name') name: string) {
    const ok = this.orchestrator.startDebug(name);
    return { success: ok };
  }

  @Post(':name/debug/command')
  sendDebugCommand(@Param('name') name: string, @Body() body: { command: string }) {
    const ok = this.orchestrator.sendDebugCommand(name, body.command);
    return { success: ok };
  }

  @Post(':name/debug/stop')
  @Auditable('bot:debug-stop')
  stopDebug(@Param('name') name: string) {
    const ok = this.orchestrator.stopDebug(name);
    return { success: ok };
  }

  @Post(':name/respawn')
  @Auditable('bot:respawn')
  respawn(@Param('name') name: string) {
    const ok = this.orchestrator.forceRespawn(name);
    return { success: ok };
  }

  @Post('batch-respawn')
  @Auditable('bot:batch-respawn')
  batchRespawn(@Body() body: { botNames: string[] }) {
    const results = body.botNames.map((name) => ({
      name,
      success: this.orchestrator.forceRespawn(name),
    }));
    return { success: true, data: results };
  }

  // ── Batch behavior ──

  @Post('batch-behavior')
  @Auditable('bot:batch-behavior')
  batchBehavior(@Body() body: { botNames: string[]; behavior: string; params?: Record<string, unknown> }) {
    const results = body.botNames.map((name) => ({
      name,
      success: this.orchestrator.setBehavior(name, body.behavior, body.params ?? {}),
    }));
    return { success: true, data: results };
  }

  @Post('batch-stop')
  @Auditable('bot:batch-stop')
  batchStop(@Body() body: { botNames: string[] }) {
    this.orchestrator.stopBots(body.botNames);
    return { success: true };
  }

  @Post('batch-delete')
  @Auditable('bot:batch-delete')
  batchDelete(@Body() body: { botNames: string[] }) {
    this.orchestrator.stopBots(body.botNames);
    for (const name of body.botNames) {
      this.stateService.removeStopped(name);
    }
    return { success: true };
  }

  @Post('batch-reconnect')
  @Auditable('bot:batch-reconnect')
  batchReconnect(@Body() body: { botNames: string[] }) {
    const results = body.botNames.map((name) => ({
      name,
      success: this.orchestrator.reconnectBot(name),
    }));
    return { success: true, data: results };
  }

  @Post('batch-script')
  @Auditable('bot:batch-script')
  batchExecuteScript(@Body() body: { botNames: string[]; script: BotScript }) {
    const results = body.botNames.map((name) => ({
      name,
      success: this.orchestrator.executeScript(name, body.script),
    }));
    return { success: true, data: results };
  }

  // ── Saved bot configs ──

  @Get('saved-configs')
  listSavedConfigs(@Query('serverId') serverId?: string) {
    return this.savedBotConfig.list(serverId).then((data) => ({ success: true, data }));
  }

  @Post('saved-configs')
  @Auditable('bot:save-config')
  @HttpCode(HttpStatus.CREATED)
  createSavedConfig(@Body() dto: CreateSavedBotConfigDto) {
    return this.savedBotConfig.create(dto).then((data) => ({ success: true, data }));
  }

  @Put('saved-configs/:id')
  @Auditable('bot:update-config')
  updateSavedConfig(@Param('id') id: string, @Body() dto: Partial<CreateSavedBotConfigDto>) {
    return this.savedBotConfig.update(id, dto).then((ok) => ({ success: ok }));
  }

  @Delete('saved-configs/:id')
  @Auditable('bot:delete-config')
  deleteSavedConfig(@Param('id') id: string) {
    return this.savedBotConfig.remove(id).then((ok) => ({ success: ok }));
  }
}

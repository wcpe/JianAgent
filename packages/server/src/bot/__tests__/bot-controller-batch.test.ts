import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotController } from '../bot.controller';
import type { BotOrchestratorService } from '../bot-orchestrator.service';
import type { BotStateService } from '../bot-state.service';
import type { SavedBotConfigService } from '../saved-bot-config.service';
import type { BotScript } from '@jian-agent/shared-protocol';

describe('BotController — batch & saved configs', () => {
  let controller: BotController;
  let orchestrator: BotOrchestratorService;
  let stateService: BotStateService;
  let savedConfigService: SavedBotConfigService;

  beforeEach(() => {
    orchestrator = {
      enrichedBots: vi.fn().mockReturnValue([]),
      getStats: vi.fn().mockReturnValue({ total: 0, online: 0, offline: 0, error: 0 }),
      setBehavior: vi.fn().mockReturnValue(true),
      stopBots: vi.fn(),
      reconnectBot: vi.fn().mockReturnValue(true),
      executeScript: vi.fn().mockReturnValue(true),
    } as unknown as BotOrchestratorService;

    stateService = {
      getBot: vi.fn().mockReturnValue(null),
      removeStopped: vi.fn(),
    } as unknown as BotStateService;

    savedConfigService = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'cfg-1', serverId: 'srv-1', namePrefix: 'bot', count: 5,
        behavior: 'idle', autoCreate: true, rejoinStrategy: 'always', maxRetries: 5,
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }),
      update: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
    } as unknown as SavedBotConfigService;

    controller = new BotController(orchestrator, stateService, savedConfigService);
  });

  it('should batch change behavior for multiple bots', () => {
    const result = controller.batchBehavior({
      botNames: ['bot-1', 'bot-2', 'bot-3'],
      behavior: 'pvp_attack',
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(orchestrator.setBehavior).toHaveBeenCalledTimes(3);
    expect(orchestrator.setBehavior).toHaveBeenCalledWith('bot-1', 'pvp_attack', {});
  });

  it('should batch stop bots', () => {
    const result = controller.batchStop({ botNames: ['bot-1', 'bot-2'] });
    expect(result.success).toBe(true);
    expect(orchestrator.stopBots).toHaveBeenCalledWith(['bot-1', 'bot-2']);
  });

  it('should batch reconnect bots', () => {
    const result = controller.batchReconnect({ botNames: ['bot-1', 'bot-2'] });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(orchestrator.reconnectBot).toHaveBeenCalledTimes(2);
  });

  it('should batch delete bots and clear stopped snapshots', () => {
    const result = controller.batchDelete({ botNames: ['bot-1', 'bot-2'] });
    expect(result.success).toBe(true);
    expect(orchestrator.stopBots).toHaveBeenCalledWith(['bot-1', 'bot-2']);
    expect(stateService.removeStopped).toHaveBeenCalledWith('bot-1');
    expect(stateService.removeStopped).toHaveBeenCalledWith('bot-2');
  });

  it('should batch execute script for multiple bots', () => {
    const script: BotScript = {
      id: 'script-1',
      name: '巡逻',
      loop: true,
      steps: [{ action: 'wait', params: { seconds: 1 } }],
    };
    const result = controller.batchExecuteScript({
      botNames: ['bot-1', 'bot-2'],
      script,
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(orchestrator.executeScript).toHaveBeenCalledWith('bot-1', script);
    expect(orchestrator.executeScript).toHaveBeenCalledWith('bot-2', script);
  });

  it('should list saved configs', async () => {
    const result = await controller.listSavedConfigs('srv-1');
    expect(result.success).toBe(true);
    expect(savedConfigService.list).toHaveBeenCalledWith('srv-1');
  });

  it('should create a saved config', async () => {
    const result = await controller.createSavedConfig({
      serverId: 'srv-1',
      namePrefix: 'bot',
      count: 5,
    });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('cfg-1');
    expect(savedConfigService.create).toHaveBeenCalledOnce();
  });

  it('should update a saved config', async () => {
    const result = await controller.updateSavedConfig('cfg-1', { behavior: 'walk_random' });
    expect(result.success).toBe(true);
    expect(savedConfigService.update).toHaveBeenCalledWith('cfg-1', { behavior: 'walk_random' });
  });

  it('should delete a saved config', async () => {
    const result = await controller.deleteSavedConfig('cfg-1');
    expect(result.success).toBe(true);
    expect(savedConfigService.remove).toHaveBeenCalledWith('cfg-1');
  });
});

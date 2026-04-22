import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhitelistActionService } from '../whitelist-action.service.js';
import type { PluginBridgeService } from '../plugin-bridge.service.js';

function createMockBridgeService(sendCommandReturn = true): PluginBridgeService {
  return {
    sendCommand: vi.fn().mockReturnValue(sendCommandReturn),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    getConnection: vi.fn(),
    getConnectionByServerId: vi.fn(),
    sendToPlugin: vi.fn(),
    getAllConnections: vi.fn().mockReturnValue([]),
  } as unknown as PluginBridgeService;
}

describe('WhitelistActionService', () => {
  let service: WhitelistActionService;
  let bridge: PluginBridgeService;

  beforeEach(() => {
    bridge = createMockBridgeService();
    service = new WhitelistActionService(bridge);
  });

  it('should reject actions not in the whitelist', async () => {
    const result = await service.execute('srv1', {
      action: 'hack_server',
      params: {},
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not in whitelist');
    expect(bridge.sendCommand).not.toHaveBeenCalled();
  });

  it('should return failure when plugin is not connected', async () => {
    bridge = createMockBridgeService(false);
    service = new WhitelistActionService(bridge);

    const result = await service.execute('srv1', {
      action: 'teleport',
      params: { target: 'player1', x: 0, y: 64, z: 0, world: 'world' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe('Plugin not connected');
  });

  it('should send command to plugin for allowed actions', async () => {
    // Don't await — the promise will pend until handleActionResult is called.
    const resultPromise = service.execute('srv1', {
      action: 'teleport',
      params: { target: 'player1', x: 0, y: 64, z: 0 },
    });

    expect(bridge.sendCommand).toHaveBeenCalledTimes(1);
    const callArgs = (bridge.sendCommand as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('srv1');
    expect(callArgs[1]).toBe('action:teleport');

    // Simulate plugin response
    const requestId = callArgs[3] as string;
    service.handleActionResult(requestId, {
      action: 'teleport',
      success: true,
      message: 'Teleported',
      timestamp: new Date().toISOString(),
    });

    const result = await resultPromise;
    expect(result.success).toBe(true);
    expect(result.message).toBe('Teleported');
  });

  it('should list all allowed actions', () => {
    const actions = service.listAllowedActions();
    expect(actions).toContain('teleport');
    expect(actions).toContain('give_equipment');
    expect(actions).toContain('reset_map');
    expect(actions).toContain('countdown');
    expect(actions).toContain('force_start');
    expect(actions).toContain('stop_game');
    expect(actions).toHaveLength(6);
  });

  it('should ignore results for unknown requestIds', () => {
    // Should not throw
    service.handleActionResult('unknown-id', {
      action: 'teleport',
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
});

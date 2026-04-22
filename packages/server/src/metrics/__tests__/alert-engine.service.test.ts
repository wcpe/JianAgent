import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertEngineService } from '../alert-engine.service.js';
import { AlertLevel, ServerState } from '@jian-agent/shared-domain';

function createMockAlertStore() {
  return {
    getEnabledRules: vi.fn().mockResolvedValue([]),
    insertAlert: vi.fn().mockResolvedValue('mock-alert-id'),
    listAlerts: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue({ totalActive: 0, criticalCount: 0, warningCount: 0, infoCount: 0 }),
    acknowledgeAlert: vi.fn().mockResolvedValue(true),
    listRules: vi.fn().mockResolvedValue([]),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  };
}

describe('AlertEngineService', () => {
  let service: AlertEngineService;
  let mockStore: ReturnType<typeof createMockAlertStore>;

  beforeEach(() => {
    mockStore = createMockAlertStore();
    service = new AlertEngineService(mockStore as any);
  });

  it('should emit alert when server crashes', () => {
    const handler = vi.fn();
    service.on('alert', handler);

    service.checkServerState(ServerState.CRASHED);

    expect(handler).toHaveBeenCalledOnce();
    const alert = handler.mock.calls[0][0];
    expect(alert.level).toBe(AlertLevel.CRITICAL);
    expect(alert.source).toBe('server');
  });

  it('should not emit alert when server is running', () => {
    const handler = vi.fn();
    service.on('alert', handler);

    service.checkServerState(ServerState.RUNNING);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should evaluate snapshot against rules and fire alert', async () => {
    mockStore.getEnabledRules.mockResolvedValue([
      {
        id: 'rule-1', name: 'Low TPS', metric: 'TPS',
        operator: 'LESS_THAN', threshold: 15, level: 'CRITICAL',
        enabled: true, cooldownSeconds: 60,
        createdAt: '', updatedAt: '',
      },
    ]);
    await service.reloadRules();

    const handler = vi.fn();
    service.on('alert.fired', handler);

    await service.evaluateSnapshot('srv-1', {
      tps: 12, mspt: 80, onlinePlayers: 5, maxPlayers: 100,
      loadedChunks: 100, entityCount: 200, worldCount: 1,
      freeMemoryMb: 512, totalMemoryMb: 2048, uptime: '00:10:00',
      timestamp: new Date().toISOString(),
    });

    expect(mockStore.insertAlert).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].level).toBe('CRITICAL');
  });

  it('should respect cooldown period', async () => {
    mockStore.getEnabledRules.mockResolvedValue([
      {
        id: 'rule-1', name: 'Low TPS', metric: 'TPS',
        operator: 'LESS_THAN', threshold: 15, level: 'WARNING',
        enabled: true, cooldownSeconds: 60,
        createdAt: '', updatedAt: '',
      },
    ]);
    await service.reloadRules();

    const snapshot = {
      tps: 10, mspt: 80, onlinePlayers: 5, maxPlayers: 100,
      loadedChunks: 100, entityCount: 200, worldCount: 1,
      freeMemoryMb: 512, totalMemoryMb: 2048, uptime: '00:10:00',
      timestamp: new Date().toISOString(),
    };

    await service.evaluateSnapshot('srv-1', snapshot);
    await service.evaluateSnapshot('srv-1', snapshot);

    // Only one alert due to cooldown
    expect(mockStore.insertAlert).toHaveBeenCalledOnce();
  });
});

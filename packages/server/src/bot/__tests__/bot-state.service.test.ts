import { describe, it, expect, beforeEach } from 'vitest';
import { BotStateService } from '../bot-state.service';
import type { StateReportPayload } from '@jian-agent/shared-protocol';

describe('BotStateService', () => {
  let service: BotStateService;

  beforeEach(() => {
    service = new BotStateService();
  });

  it('should absorb state report from worker', () => {
    const report: StateReportPayload = {
      bots: [
        { name: 'bot_1', state: 'SPAWNED' as any, x: 0, y: 0, z: 0, health: 20, latencyMs: 10, world: 'world', currentBehavior: 'idle', lastHeartbeat: Date.now() },
      ],
    };
    service.absorb(1001, report);
    const all = service.allBots();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('bot_1');
  });

  it('should return summary for a specific bot', () => {
    service.absorb(1001, {
      bots: [{ name: 'bot_1', state: 'SPAWNED' as any, x: 0, y: 0, z: 0, health: 20, latencyMs: 10, world: 'world', currentBehavior: 'idle', lastHeartbeat: Date.now() }],
    });
    const bot = service.getBot('bot_1');
    expect(bot?.state).toBe('SPAWNED');
  });

  it('should return undefined for unknown bot', () => {
    expect(service.getBot('unknown')).toBeUndefined();
  });

  it('should clear state for a killed worker', () => {
    service.absorb(1001, {
      bots: [{ name: 'bot_1', state: 'SPAWNED' as any, x: 0, y: 0, z: 0, health: 20, latencyMs: 10, world: 'world', currentBehavior: 'idle', lastHeartbeat: Date.now() }],
    });
    service.removeWorker(1001);
    const bots = service.allBots();
    expect(bots).toHaveLength(1);
    expect(bots[0].name).toBe('bot_1');
    expect(bots[0].state).toBe('STOPPED');
    expect(bots[0].workerPid).toBe(0);
  });

  it('should pass through enriched position/health/latency fields', () => {
    const now = Date.now();
    service.absorb(1001, {
      bots: [{
        name: 'bot_rich',
        state: 'SPAWNED' as any,
        currentBehavior: 'walk_random',
        x: 123.5,
        y: 64.0,
        z: -200.3,
        health: 18.5,
        food: 15,
        latencyMs: 42,
        world: 'world_nether',
        connectedAt: '2026-04-07T10:00:00Z',
        lastError: 'Connection reset',
        lastHeartbeat: now,
      }],
    });
    const bot = service.getBot('bot_rich');
    expect(bot).toBeDefined();
    expect(bot!.x).toBe(123.5);
    expect(bot!.y).toBe(64.0);
    expect(bot!.z).toBe(-200.3);
    expect(bot!.health).toBe(18.5);
    expect(bot!.food).toBe(15);
    expect(bot!.latencyMs).toBe(42);
    expect(bot!.world).toBe('world_nether');
    expect(bot!.connectedAt).toBe('2026-04-07T10:00:00Z');
    expect(bot!.lastError).toBe('Connection reset');
    expect(bot!.lastHeartbeat).toBe(now);
  });

  it('should default missing enriched fields', () => {
    service.absorb(1001, {
      bots: [{ name: 'bot_minimal', state: 'SPAWNED' as any, currentBehavior: 'idle' } as any],
    });
    const bot = service.getBot('bot_minimal');
    expect(bot).toBeDefined();
    expect(bot!.x).toBe(0);
    expect(bot!.y).toBe(0);
    expect(bot!.z).toBe(0);
    expect(bot!.health).toBe(0);
    expect(bot!.food).toBe(0);
    expect(bot!.latencyMs).toBe(0);
    expect(bot!.world).toBe('');
    expect(bot!.connectedAt).toBeNull();
    expect(bot!.lastError).toBeNull();
  });
});

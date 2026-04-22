import { describe, it, expect } from 'vitest';
import { BotState, SessionState, PhaseType } from '../index.js';
import type {
  BotConfig,
  BotSummary,
  BotDetail,
  CreateBotGroupRequest,
  SessionConfig,
  CreateSessionRequest,
  SessionSummary,
  SessionDetail,
  PhaseRecord,
} from '../index.js';

describe('BotConfig type', () => {
  it('should allow creating a valid config object', () => {
    const config: BotConfig = {
      id: 'bg-1',
      serverHost: 'localhost',
      serverPort: 25565,
      namePattern: 'bot_{n}',
      count: 10,
      spawnIntervalMs: 200,
      connectTimeoutMs: 30000,
      reconnectEnabled: true,
      reconnectMaxRetries: 5,
      behaviorTemplate: 'idle',
      debugLevel: 'info',
      createdAt: '2026-04-06T00:00:00Z',
    };
    expect(config.count).toBe(10);
  });
});

describe('BotSummary type', () => {
  it('should allow creating a valid summary', () => {
    const summary: BotSummary = {
      name: 'bot_1',
      state: BotState.READY,
      x: 0,
      y: 64,
      z: 0,
      health: 20,
      food: 20,
      latencyMs: 45,
      world: 'world',
      currentBehavior: 'idle',
      isDead: false,
      deathCount: 0,
      lastHeartbeat: Date.now(),
    };
    expect(summary.state).toBe('READY');
  });
});

describe('SessionConfig type', () => {
  it('should allow creating a valid session', () => {
    const session: CreateSessionRequest = {
      name: 'Stress Test 1',
      serverConfigId: 'sc-1',
      botGroupId: 'bg-1',
      phases: [
        { type: PhaseType.WAITING, durationMs: 5000 },
        { type: PhaseType.LOGIN_IDLE, durationMs: 10000 },
      ],
    };
    expect(session.phases).toHaveLength(2);
  });
});

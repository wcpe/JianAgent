import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotRealtimeService } from '../bot-realtime.service';

describe('BotRealtimeService', () => {
  let service: BotRealtimeService;
  let mockGateway: { broadcastChannel: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGateway = { broadcastChannel: vi.fn() };
    service = new BotRealtimeService(mockGateway as any);
  });

  it('should broadcast bot state push', () => {
    service.pushBotState([{ name: 'bot_1', state: 'SPAWNED', behavior: 'idle' }]);
    expect(mockGateway.broadcastChannel).toHaveBeenCalledWith(
      'resource:bot:state',
      expect.objectContaining({ bots: expect.any(Array) }),
    );
  });

  it('should broadcast bot event', () => {
    service.pushBotEvent({
      botName: 'bot_1',
      event: 'SPAWNED',
      message: 'bot_1 spawned',
      timestamp: 1_713_600_000_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
    });
    expect(mockGateway.broadcastChannel).toHaveBeenCalledWith(
      'task:bot:event',
      expect.objectContaining({
        botName: 'bot_1',
        event: 'SPAWNED',
        timestamp: 1_713_600_000_000,
        serverId: 'srv-1',
        batchId: 'batch-1',
        validationRunId: 'run-1',
      }),
    );
  });

  it('should retain recent bot events for later evidence queries', () => {
    service.pushBotEvent({
      botName: 'bot_1',
      event: 'SPAWNED',
      message: 'bot_1 spawned',
      timestamp: 1_713_600_000_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
    });
    service.pushBotEvent({
      botName: 'bot_2',
      event: 'DIED',
      message: 'bot_2 died',
      timestamp: 1_713_600_001_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-2',
    });

    const results = service.getRecentBotEvents({ validationRunId: 'run-1', limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      botName: 'bot_1',
      event: 'SPAWNED',
      timestamp: 1_713_600_000_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
    });
  });

  it('should filter recent bot events by sinceTimestamp', () => {
    service.pushBotEvent({
      botName: 'bot_1',
      event: 'BUILD_FAILURE',
      message: 'older event',
      timestamp: 100,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
      metadata: { reason: 'reference-face' },
    });
    service.pushBotEvent({
      botName: 'bot_1',
      event: 'BUILD_FAILURE',
      message: 'newer event',
      timestamp: 200,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
      metadata: { reason: 'line-of-sight' },
    });

    const results = service.getRecentBotEvents({
      validationRunId: 'run-1',
      sinceTimestamp: 150,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      message: 'newer event',
      metadata: { reason: 'line-of-sight' },
    });
  });

  it('should retain recent chat messages for validation-run scoped queries', () => {
    service.pushChatMessage({
      botName: 'bot_1',
      message: 'hello world',
      timestamp: 1_713_600_002_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
    });
    service.pushChatMessage({
      botName: 'bot_2',
      message: 'another run',
      timestamp: 1_713_600_003_000,
      serverId: 'srv-1',
      batchId: 'batch-2',
      validationRunId: 'run-2',
    });

    const results = service.getRecentChatMessages({ validationRunId: 'run-1', limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      botName: 'bot_1',
      message: 'hello world',
      timestamp: 1_713_600_002_000,
      serverId: 'srv-1',
      batchId: 'batch-1',
      validationRunId: 'run-1',
    });
  });

  it('should broadcast session state', () => {
    service.pushSessionState('sess_1', 'RUNNING', 'ramp-up');
    expect(mockGateway.broadcastChannel).toHaveBeenCalledWith(
      'resource:session:state',
      expect.objectContaining({ sessionId: 'sess_1', state: 'RUNNING' }),
    );
  });

  it('should broadcast session phase change', () => {
    service.pushSessionPhase('sess_1', 'peak', 10, 'move-random');
    expect(mockGateway.broadcastChannel).toHaveBeenCalledWith(
      'task:session:phase',
      expect.objectContaining({ sessionId: 'sess_1', phase: 'peak' }),
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { LogQueryStrategyService } from '../log-query-strategy.service.js';

describe('LogQueryStrategyService', () => {
  it('returns local-file results in local mode', async () => {
    const localBackend = {
      search: vi.fn().mockResolvedValue([{ serverId: 'srv-1', file: 'latest.log', line: 1, content: 'ERROR' }]),
    };
    const lokiBackend = {
      search: vi.fn(),
    };

    const service = new LogQueryStrategyService(localBackend as any, lokiBackend as any, {
      logBackendMode: 'local-file',
    });

    const result = await service.aggregateSearch({ query: 'ERROR' });

    expect(result.backend).toBe('local-file');
    expect(result.degraded).toBe(false);
    expect(result.entries).toHaveLength(1);
    expect(lokiBackend.search).not.toHaveBeenCalled();
  });

  it('falls back to local-file when loki backend is unavailable', async () => {
    const localBackend = {
      search: vi.fn().mockResolvedValue([{ serverId: 'srv-1', file: 'latest.log', line: 1, content: 'ERROR' }]),
    };
    const lokiBackend = {
      search: vi.fn().mockRejectedValue(new Error('LOKI_UNAVAILABLE')),
    };

    const service = new LogQueryStrategyService(localBackend as any, lokiBackend as any, {
      logBackendMode: 'loki',
    });

    const result = await service.aggregateSearch({ query: 'ERROR' });

    expect(result.requestedBackend).toBe('loki');
    expect(result.backend).toBe('local-file');
    expect(result.degraded).toBe(true);
    expect(result.degradationReason).toBe('LOKI_UNAVAILABLE');
    expect(localBackend.search).toHaveBeenCalledOnce();
  });

  it('returns recent local-file results and degrades from loki mode when needed', async () => {
    const localBackend = {
      search: vi.fn(),
      recent: vi.fn().mockResolvedValue([{ serverId: 'srv-1', file: 'latest.log', line: 4, content: 'Done' }]),
    };
    const lokiBackend = {
      search: vi.fn(),
      recent: vi.fn().mockRejectedValue(new Error('LOKI_UNAVAILABLE')),
    };

    const service = new LogQueryStrategyService(localBackend as any, lokiBackend as any, {
      logBackendMode: 'hybrid',
    });

    const result = await service.recentLogs({ serverIds: ['srv-1'], linesPerServer: 20 });

    expect(result.requestedBackend).toBe('hybrid');
    expect(result.backend).toBe('local-file');
    expect(result.degraded).toBe(true);
    expect(localBackend.recent).toHaveBeenCalledWith({ serverIds: ['srv-1'], linesPerServer: 20 });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { logsApi } from '../logs.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logsApi', () => {
  it('aggregateSearch builds full query parameters', async () => {
    mockedFetch.mockResolvedValue({
      entries: [],
      backend: 'local-file',
      degraded: false,
    } as any);

    await logsApi.aggregateSearch({
      query: 'ERROR',
      serverIds: ['srv-1', 'srv-2'],
      maxPerServer: 120,
      maxTotal: 600,
      startTime: '2026-04-14T12:00',
      endTime: '2026-04-14T18:00',
      caseSensitive: true,
      fields: ['content', 'file'],
    });

    const calledUrl = mockedFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/logs/aggregate?');
    expect(calledUrl).toContain('q=ERROR');
    expect(calledUrl).toContain('serverIds=srv-1%2Csrv-2');
    expect(calledUrl).toContain('maxPerServer=120');
    expect(calledUrl).toContain('maxTotal=600');
    expect(calledUrl).toContain('startTime=2026-04-14T12%3A00');
    expect(calledUrl).toContain('endTime=2026-04-14T18%3A00');
    expect(calledUrl).toContain('caseSensitive=true');
    expect(calledUrl).toContain('fields=content%2Cfile');
  });

  it('aggregateSearch only keeps required query when optional filters are absent', async () => {
    mockedFetch.mockResolvedValue({
      entries: [],
      backend: 'local-file',
      degraded: false,
    } as any);

    await logsApi.aggregateSearch({ query: 'timeout' });

    expect(mockedFetch).toHaveBeenCalledWith('/logs/aggregate?q=timeout');
  });

  it('aggregateSearch returns backend metadata alongside entries', async () => {
    mockedFetch.mockResolvedValue({
      entries: [{ serverId: 'srv-1', file: 'latest.log', line: 7, content: 'timeout' }],
      backend: 'hybrid',
      degraded: true,
      requestedBackend: 'loki',
      degradationReason: 'LOKI_UNAVAILABLE',
    } as any);

    const result = await logsApi.aggregateSearch({ query: 'timeout' });

    expect(result.backend).toBe('hybrid');
    expect(result.degraded).toBe(true);
    expect(result.degradationReason).toBe('LOKI_UNAVAILABLE');
    expect(result.entries).toHaveLength(1);
  });

  it('recent builds query parameters for recent log mode', async () => {
    mockedFetch.mockResolvedValue({
      entries: [],
      backend: 'local-file',
      degraded: false,
    } as any);

    await logsApi.recent({
      serverIds: ['srv-1', 'srv-2'],
      linesPerServer: 80,
      maxTotal: 240,
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      '/logs/recent?serverIds=srv-1%2Csrv-2&linesPerServer=80&maxTotal=240',
    );
  });
});

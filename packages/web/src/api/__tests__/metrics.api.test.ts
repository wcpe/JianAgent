import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { metricsApi } from '../metrics.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('metricsApi', () => {
  it('getHistory builds query and unwraps .data', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [{ ts: 1 }] });
    const result = await metricsApi.getHistory({ serverId: 's1', limit: 100 });
    const url = mockedFetch.mock.calls[0]![0] as string;
    expect(url).toContain('/metrics/history');
    expect(url).toContain('serverId=s1');
    expect(url).toContain('limit=100');
    expect(result).toEqual([{ ts: 1 }]);
  });

  it('getHistory returns empty array when data is null', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: null });
    const result = await metricsApi.getHistory();
    expect(result).toEqual([]);
  });

  it('getLatest returns data or null', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: { tps: 20 } });
    const result = await metricsApi.getLatest('s1');
    expect(mockedFetch.mock.calls[0]![0]).toContain('/metrics/latest?serverId=s1');
    expect(result).toEqual({ tps: 20 });
  });

  it('getWorldMetrics builds query and unwraps .data', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [{ world: 'overworld' }] });
    const result = await metricsApi.getWorldMetrics({ serverId: 's1' });
    expect(mockedFetch.mock.calls[0]![0]).toContain('/metrics/worlds');
    expect(result).toEqual([{ world: 'overworld' }]);
  });

  it('cleanupMetrics sends DELETE and returns message', async () => {
    mockedFetch.mockResolvedValue({ success: true, message: 'Deleted 42 rows' });
    const result = await metricsApi.cleanupMetrics(7);
    expect(mockedFetch).toHaveBeenCalledWith('/metrics/retention?days=7', { method: 'DELETE' });
    expect(result).toBe('Deleted 42 rows');
  });
});

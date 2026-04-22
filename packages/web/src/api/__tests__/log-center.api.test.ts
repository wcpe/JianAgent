import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../client.js';
import { logCenterApi } from '../log-center.api.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logCenterApi', () => {
  it('unwraps search response envelopes', async () => {
    mockedFetch.mockResolvedValue({
      success: true,
      data: {
        entries: [],
        total: 0,
        page: 1,
        limit: 50,
        highlightMap: new Map(),
      },
    } as never);

    const result = await logCenterApi.search({ q: 'timeout' });

    expect(result.total).toBe(0);
    expect(mockedFetch).toHaveBeenCalledWith('/logs/search?q=timeout');
  });

  it('sends hosts to analytics and unwraps the response', async () => {
    mockedFetch.mockResolvedValue({
      success: true,
      data: {
        levelDistribution: { ERROR: 1 },
        timelineBuckets: [],
        topKeywords: [],
      },
    } as never);

    const result = await logCenterApi.analytics({
      hosts: ['srv-1', 'remote:host-1'],
      level: 'ERROR',
    });

    expect(result.levelDistribution.ERROR).toBe(1);
    expect(mockedFetch).toHaveBeenCalledWith('/logs/analytics?hosts=srv-1%2Cremote%3Ahost-1&level=ERROR');
  });
});

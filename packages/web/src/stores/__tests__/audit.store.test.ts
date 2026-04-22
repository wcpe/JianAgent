import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuditStore } from '../audit.store.js';

vi.mock('../../api/audit.api.js', () => ({
  auditApi: {
    list: vi.fn(),
  },
}));

import { auditApi } from '../../api/audit.api.js';

const mockedApi = vi.mocked(auditApi);

describe('useAuditStore', () => {
  beforeEach(() => {
    useAuditStore.setState({
      records: [],
      total: 0,
      filters: { page: 1, limit: 20 },
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('fetchRecords updates records and total on success', async () => {
    const mockResponse = {
      items: [
        { id: 'a1', timestamp: '2024-01-01T00:00:00Z', userId: 'u1', username: 'admin', operation: 'server.start', target: 'c1', params: '{}', success: true, ip: '127.0.0.1' },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockedApi.list.mockResolvedValue(mockResponse as any);

    await useAuditStore.getState().fetchRecords();

    expect(useAuditStore.getState().records).toEqual(mockResponse.items);
    expect(useAuditStore.getState().total).toBe(1);
    expect(useAuditStore.getState().loading).toBe(false);
  });

  it('fetchRecords sets error on failure', async () => {
    mockedApi.list.mockRejectedValue(new Error('Forbidden'));

    await useAuditStore.getState().fetchRecords();

    expect(useAuditStore.getState().error).toBe('Forbidden');
    expect(useAuditStore.getState().loading).toBe(false);
  });

  it('setFilters merges filters and resets page', () => {
    useAuditStore.getState().setFilters({ userId: 'u1' });
    expect(useAuditStore.getState().filters.userId).toBe('u1');
    expect(useAuditStore.getState().filters.limit).toBe(20);
  });
});

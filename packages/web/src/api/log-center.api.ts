import { apiFetch } from './client.js';
import type {
  LogSearchRequest,
  LogSearchResult,
  LogAnalyticsResult,
  LogCollectionConfigDto,
  CreateLogCollectionConfigRequest,
  LogAlertRuleDto,
  CreateLogAlertRuleRequest,
  LogAggregateSearchResponseDto,
} from '@jian-agent/shared-domain';

function unwrapEnvelope<T>(payload: T | { success: boolean; data: T }): T {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as { success: boolean; data: T }).data;
  }
  return payload as T;
}

export const logCenterApi = {
  search: async (params: LogSearchRequest): Promise<LogSearchResult> => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.hosts && params.hosts.length > 0) query.set('hosts', params.hosts.join(','));
    if (params.level) query.set('level', params.level);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    if (params.source) query.set('source', params.source);
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.highlight != null) query.set('highlight', String(params.highlight));

    const qs = query.toString();
    const res = await apiFetch<LogSearchResult | { success: boolean; data: LogSearchResult }>(`/logs/search${qs ? `?${qs}` : ''}`);
    return unwrapEnvelope(res);
  },

  analytics: async (params: {
    hosts?: readonly string[];
    level?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<LogAnalyticsResult> => {
    const query = new URLSearchParams();
    if (params.hosts && params.hosts.length > 0) query.set('hosts', params.hosts.join(','));
    if (params.level) query.set('level', params.level);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);

    const qs = query.toString();
    const res = await apiFetch<LogAnalyticsResult | { success: boolean; data: LogAnalyticsResult }>(`/logs/analytics${qs ? `?${qs}` : ''}`);
    return unwrapEnvelope(res);
  },

  recent: async (params?: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
  }): Promise<LogAggregateSearchResponseDto> => {
    const query = new URLSearchParams();
    if (params?.serverIds && params.serverIds.length > 0) query.set('serverIds', params.serverIds.join(','));
    if (params?.linesPerServer != null) query.set('linesPerServer', String(params.linesPerServer));
    if (params?.maxTotal != null) query.set('maxTotal', String(params.maxTotal));

    const qs = query.toString();
    return apiFetch<LogAggregateSearchResponseDto>(`/logs/recent${qs ? `?${qs}` : ''}`);
  },

  listCollections: async (): Promise<readonly LogCollectionConfigDto[]> => {
    const res = await apiFetch<{ success: boolean; data: readonly LogCollectionConfigDto[] }>('/log-collections');
    return res.data ?? [];
  },

  createCollection: async (req: CreateLogCollectionConfigRequest): Promise<LogCollectionConfigDto> => {
    const res = await apiFetch<{ success: boolean; data: LogCollectionConfigDto }>('/log-collections', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    return res.data;
  },

  deleteCollection: async (id: string): Promise<{ success: boolean }> => {
    return apiFetch<{ success: boolean }>(`/log-collections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  listAlertRules: async (): Promise<readonly LogAlertRuleDto[]> => {
    const res = await apiFetch<{ success: boolean; data: readonly LogAlertRuleDto[] }>('/log-alert-rules');
    return res.data ?? [];
  },

  createAlertRule: async (req: CreateLogAlertRuleRequest): Promise<LogAlertRuleDto> => {
    const res = await apiFetch<{ success: boolean; data: LogAlertRuleDto }>('/log-alert-rules', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    return res.data;
  },

  deleteAlertRule: async (id: string): Promise<{ success: boolean }> => {
    return apiFetch<{ success: boolean }>(`/log-alert-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  exportAll: async (params: { q?: string; hosts?: string[]; level?: string; startTime?: string; endTime?: string; format?: string }): Promise<{ success: boolean; data: { format: string; content?: string; entries?: unknown[]; total?: number } }> => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.hosts?.length) query.set('hosts', params.hosts.join(','));
    if (params.level) query.set('level', params.level);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    query.set('format', params.format ?? 'csv');
    query.set('limit', '5000');
    return apiFetch<{ success: boolean; data: { format: string; content?: string; entries?: unknown[]; total?: number } }>(`/logs/export?${query.toString()}`);
  },
} as const;

// Backward-compatible exports used by existing pages (LogAlertRules.tsx, LogCollectionManager.tsx)
export const logAlertRuleApi = {
  list: () =>
    apiFetch<readonly LogAlertRuleDto[]>('/log-alert-rules'),

  create: (req: CreateLogAlertRuleRequest) =>
    apiFetch<LogAlertRuleDto>('/log-alert-rules', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  update: (id: string, req: Partial<CreateLogAlertRuleRequest>) =>
    apiFetch<LogAlertRuleDto>(`/log-alert-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/log-alert-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  toggleEnabled: (id: string, enabled: boolean) =>
    apiFetch<LogAlertRuleDto>(`/log-alert-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
} as const;

export const logCollectionApi = {
  list: () =>
    apiFetch<readonly LogCollectionConfigDto[]>('/log-collection-configs'),

  create: (req: CreateLogCollectionConfigRequest) =>
    apiFetch<LogCollectionConfigDto>('/log-collection-configs', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/log-collection-configs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  toggleEnabled: (id: string, enabled: boolean) =>
    apiFetch<LogCollectionConfigDto>(`/log-collection-configs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
} as const;

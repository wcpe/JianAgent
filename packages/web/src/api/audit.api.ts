import { apiFetch } from './client.js';
import type { AuditRecord, AuditQueryParams, PaginatedResponse } from '@jian-agent/shared-domain';

export const auditApi = {
  list: (filters: AuditQueryParams = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.operation) params.set('operation', filters.operation);
    if (filters.startTime) params.set('startTime', filters.startTime);
    if (filters.endTime) params.set('endTime', filters.endTime);
    if (filters.page != null) params.set('page', String(filters.page));
    if (filters.limit != null) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return apiFetch<PaginatedResponse<AuditRecord>>(
      `/audit${qs ? `?${qs}` : ''}`,
    );
  },
} as const;

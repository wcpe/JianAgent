import { apiFetch } from '../../api/client.js';
import type { AlertDto, AlertSummaryDto, AlertRuleDto, CreateAlertRuleDto, UpdateAlertRuleDto } from '@jian-agent/shared-domain';

export const alertsApi = {
  listAlerts: (limit?: number): Promise<AlertDto[]> =>
    apiFetch<AlertDto[]>(`/metrics/alerts${limit ? `?limit=${limit}` : ''}`),

  getSummary: (): Promise<AlertSummaryDto> =>
    apiFetch<AlertSummaryDto>('/metrics/alerts/summary'),

  acknowledge: (alertId: string): Promise<{ acknowledged: boolean }> =>
    apiFetch<{ acknowledged: boolean }>(`/metrics/alerts/${alertId}/acknowledge`, { method: 'POST' }),

  listRules: (): Promise<AlertRuleDto[]> =>
    apiFetch<AlertRuleDto[]>('/metrics/alert-rules'),

  createRule: (dto: CreateAlertRuleDto): Promise<AlertRuleDto> =>
    apiFetch<AlertRuleDto>('/metrics/alert-rules', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateRule: (id: string, dto: UpdateAlertRuleDto): Promise<AlertRuleDto> =>
    apiFetch<AlertRuleDto>(`/metrics/alert-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteRule: (id: string): Promise<{ deleted: boolean }> =>
    apiFetch<{ deleted: boolean }>(`/metrics/alert-rules/${id}`, { method: 'DELETE' }),
} as const;

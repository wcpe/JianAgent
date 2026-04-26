import { apiFetch } from '../../api/client.js';
import type { AlertDto, AlertSummaryDto, AlertRuleDto, CreateAlertRuleDto, UpdateAlertRuleDto } from '@jian-agent/shared-domain';

export const alertsApi = {
  listAlerts: async (limit?: number): Promise<AlertDto[]> => {
    const res = await apiFetch<{ success: boolean; data: AlertDto[] }>(`/metrics/alerts${limit ? `?limit=${limit}` : ''}`);
    return res.data ?? [];
  },

  getSummary: async (): Promise<AlertSummaryDto> => {
    const res = await apiFetch<{ success: boolean; data: AlertSummaryDto }>('/metrics/alerts/summary');
    return res.data;
  },

  acknowledge: async (alertId: string): Promise<{ acknowledged: boolean }> => {
    const res = await apiFetch<{ success: boolean; data: { acknowledged: boolean } }>(`/metrics/alerts/${alertId}/acknowledge`, { method: 'POST' });
    return res.data;
  },

  listRules: async (): Promise<AlertRuleDto[]> => {
    const res = await apiFetch<{ success: boolean; data: AlertRuleDto[] }>('/metrics/alert-rules');
    return res.data ?? [];
  },

  createRule: async (dto: CreateAlertRuleDto): Promise<AlertRuleDto> => {
    const res = await apiFetch<{ success: boolean; data: AlertRuleDto }>('/metrics/alert-rules', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return res.data;
  },

  updateRule: async (id: string, dto: UpdateAlertRuleDto): Promise<AlertRuleDto> => {
    const res = await apiFetch<{ success: boolean; data: AlertRuleDto }>(`/metrics/alert-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    return res.data;
  },

  deleteRule: async (id: string): Promise<{ deleted: boolean }> => {
    const res = await apiFetch<{ success: boolean; data: { deleted: boolean } }>(`/metrics/alert-rules/${id}`, { method: 'DELETE' });
    return res.data;
  },
} as const;

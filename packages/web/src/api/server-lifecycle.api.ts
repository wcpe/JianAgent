import { apiFetch } from './client.js';
import type { ServerValidationResult, ProcessMetrics } from '@jian-agent/shared-domain';

export const serverLifecycleApi = {
  validate: (id: string) =>
    apiFetch<ServerValidationResult>(`/servers/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
    }),

  getProcessMetrics: (id: string, from?: string) =>
    apiFetch<{ serverId: string; metrics: ProcessMetrics[] }>(
      `/servers/${encodeURIComponent(id)}/metrics${from ? `?from=${encodeURIComponent(from)}` : ''}`
    ),

  getMetricsSummary: (id: string) =>
    apiFetch<{
      serverId: string;
      current: ProcessMetrics | null;
      peak: { cpuPercent: number; rssBytes: number };
      average: { cpuPercent: number; rssBytes: number };
    }>(`/servers/${encodeURIComponent(id)}/metrics/summary`),
};

import { apiFetch } from './client.js';
import type {
  SessionReportDto,
  ArchiveResultDto,
  ArchiveStatsDto,
} from '@jian-agent/shared-domain';

interface MetricTimeSeriesPoint {
  readonly timestamp: number;
  readonly value: number;
}

export const reportApi = {
  getSessionReport: (sessionId: string) =>
    apiFetch<SessionReportDto>(`/metrics/report/${encodeURIComponent(sessionId)}`),

  getSessionMetrics: (sessionId: string, metric: string) =>
    apiFetch<MetricTimeSeriesPoint[]>(
      `/metrics/session/${encodeURIComponent(sessionId)}/${encodeURIComponent(metric)}`,
    ),

  exportReportUrl: (sessionId: string, format: 'html' | 'pdf' | 'json') =>
    `/api/v1/metrics/report/${encodeURIComponent(sessionId)}/export/${format}`,

  getArchiveStats: () => apiFetch<ArchiveStatsDto>('/storage/archive/stats'),

  triggerArchive: () =>
    apiFetch<ArchiveResultDto>('/storage/archive', { method: 'POST' }),

  updateRetention: (days: number) =>
    apiFetch<void>('/storage/archive/config', {
      method: 'PATCH',
      body: JSON.stringify({ retentionDays: days }),
    }),
} as const;

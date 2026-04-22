import { apiFetch } from './client.js';
import type { MetricSnapshotDto, WorldMetricSnapshotDto, JmxMetricSnapshotDto, JmxMetricBucketDto, MonitoringOverviewDto } from '@jian-agent/shared-domain';

export const metricsApi = {
  getHistory: async (params?: {
    serverId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<MetricSnapshotDto[]> => {
    const query = new URLSearchParams();
    if (params?.serverId) query.set('serverId', params.serverId);
    if (params?.startTime) query.set('startTime', params.startTime);
    if (params?.endTime) query.set('endTime', params.endTime);
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const res = await apiFetch<{ success: boolean; data: MetricSnapshotDto[] }>(`/metrics/history${qs ? `?${qs}` : ''}`);
    return res.data ?? [];
  },

  getLatest: async (serverId: string): Promise<MetricSnapshotDto | null> => {
    const res = await apiFetch<{ success: boolean; data: MetricSnapshotDto | null }>(`/metrics/latest?serverId=${encodeURIComponent(serverId)}`);
    return res.data ?? null;
  },

  getOverview: async (serverId: string): Promise<MonitoringOverviewDto> => {
    const res = await apiFetch<{ success: boolean; data: MonitoringOverviewDto }>(`/metrics/overview?serverId=${encodeURIComponent(serverId)}`);
    return res.data;
  },

  getWorldMetrics: async (params?: {
    serverId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<WorldMetricSnapshotDto[]> => {
    const query = new URLSearchParams();
    if (params?.serverId) query.set('serverId', params.serverId);
    if (params?.startTime) query.set('startTime', params.startTime);
    if (params?.endTime) query.set('endTime', params.endTime);
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const res = await apiFetch<{ success: boolean; data: WorldMetricSnapshotDto[] }>(`/metrics/worlds${qs ? `?${qs}` : ''}`);
    return res.data ?? [];
  },

  cleanupMetrics: async (days: number): Promise<string> => {
    const res = await apiFetch<{ success: boolean; message: string }>(`/metrics/retention?days=${days}`, { method: 'DELETE' });
    return res.message;
  },

  collectJmx: async (input: { serverId: string; pid: string }): Promise<JmxMetricSnapshotDto> => {
    const res = await apiFetch<{ success: boolean; data: JmxMetricSnapshotDto }>('/metrics/jmx/collect', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  getJmxLatest: async (serverId: string): Promise<JmxMetricSnapshotDto | null> => {
    const res = await apiFetch<{ success: boolean; data: JmxMetricSnapshotDto | null }>(`/metrics/jmx/latest?serverId=${encodeURIComponent(serverId)}`);
    return res.data ?? null;
  },

  getJmxHistory: async (params: {
    serverId: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<JmxMetricSnapshotDto[]> => {
    const query = new URLSearchParams();
    query.set('serverId', params.serverId);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    if (params.limit) query.set('limit', String(params.limit));

    const res = await apiFetch<{ success: boolean; data: JmxMetricSnapshotDto[] }>(`/metrics/jmx/history?${query.toString()}`);
    return res.data ?? [];
  },

  getJmxHistoryAggregated: async (params: {
    serverId: string;
    startTime?: string;
    endTime?: string;
    intervalSec?: number;
    limit?: number;
  }): Promise<JmxMetricBucketDto[]> => {
    const query = new URLSearchParams();
    query.set('serverId', params.serverId);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    if (params.intervalSec) query.set('intervalSec', String(params.intervalSec));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await apiFetch<{ success: boolean; data: JmxMetricBucketDto[] }>(`/metrics/jmx/history-aggregated?${query.toString()}`);
    return res.data ?? [];
  },

  createJmxSchedule: async (input: {
    serverId: string;
    pid: string;
    intervalSec: number;
    heapUsedThresholdMb?: number;
    threadThreshold?: number;
  }) => {
    const res = await apiFetch<{ success: boolean; data: any }>('/metrics/jmx/schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  listJmxSchedules: async () => {
    const res = await apiFetch<{ success: boolean; data: any[] }>('/metrics/jmx/schedules');
    return res.data ?? [];
  },

  removeJmxSchedule: async (id: string) => {
    const res = await apiFetch<{ success: boolean; data: { removed: boolean } }>(`/metrics/jmx/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.data.removed;
  },
} as const;

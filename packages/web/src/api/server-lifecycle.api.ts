import { apiFetch } from './client.js';
import type {
  ServerWithStatusDto,
  ServerValidationResult,
  ProcessMetrics,
} from '@jian-agent/shared-domain';

export const serverLifecycleApi = {
  // ── Query ──

  listServers: () =>
    apiFetch<readonly ServerWithStatusDto[]>('/servers'),

  getServer: (id: string) =>
    apiFetch<ServerWithStatusDto>(`/servers/${encodeURIComponent(id)}`),

  listJavaProcesses: () =>
    apiFetch<{ success: boolean; data: Array<{ pid: number; command: string }> }>('/servers/java-processes'),

  // ── Lifecycle actions ──

  batchOperation: (action: string, serverIds: string[], stopMode?: string) =>
    apiFetch<{ results: Array<{ serverId: string; success: boolean; error?: string }> }>(
      '/servers/batch',
      { method: 'POST', body: JSON.stringify({ action, serverIds, stopMode }) },
    ),

  startServer: (id: string) =>
    apiFetch<{ success: boolean; pid?: number }>(`/servers/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    }),

  stopServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
    }),

  interruptServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/interrupt`, {
      method: 'POST',
    }),

  restartServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/restart`, {
      method: 'POST',
    }),

  pingServer: (id: string) =>
    apiFetch<{ success: boolean; data: { online: boolean; motd?: string; onlinePlayers?: number; maxPlayers?: number; version?: string } }>(
      `/servers/${encodeURIComponent(id)}/ping`,
      { method: 'POST' },
    ),

  attachProcess: (id: string, pid: number) =>
    apiFetch<{ success: boolean; state: string }>(`/servers/${encodeURIComponent(id)}/attach`, {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),

  detachProcess: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/detach`, {
      method: 'POST',
    }),

  // ── Validation & Metrics ──

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
} as const;

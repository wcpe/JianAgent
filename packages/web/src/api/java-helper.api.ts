import { apiFetch } from './client.js';
import type { JavaHelperStatusDto, ThreadSampleDto, HeapSampleDto } from '@jian-agent/shared-domain';

export interface JarScanResult {
  readonly entryClasses: ReadonlyArray<{ className: string; isMainClass: boolean; source: string }>;
  readonly manifest: Record<string, string>;
  readonly totalClasses: number;
}

export interface JvmRecommendation {
  readonly recommended: readonly string[];
  readonly explanation: readonly string[];
}

export interface JfrTask {
  readonly id: string;
  readonly serverId: string;
  readonly pid: string;
  readonly recordingName: string;
  readonly status: 'running' | 'completed' | 'failed' | 'expired' | 'pending' | 'approved';
  readonly filePath: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly error?: string;
}

export const javaHelperApi = {
  getStatus: () =>
    apiFetch<{ success: boolean; data: JavaHelperStatusDto }>('/java-helper/status'),

  start: () =>
    apiFetch<{ success: boolean }>('/java-helper/start', { method: 'POST' }),

  resolve: () =>
    apiFetch<{ success: boolean; data: any }>('/java-helper/resolve', { method: 'POST' }),

  scanJar: (jarPath: string) =>
    apiFetch<{ success: boolean; data: JarScanResult }>('/java-helper/scan-jar', {
      method: 'POST',
      body: JSON.stringify({ jarPath }),
    }),

  getEntryClasses: (jarPath: string) =>
    apiFetch<{ success: boolean; data: JarScanResult }>(
      `/java-helper/entry-classes?jarPath=${encodeURIComponent(jarPath)}`,
    ),

  recommendJvmArgs: (jarPath: string, maxMemoryMb?: number) =>
    apiFetch<{ success: boolean; data: JvmRecommendation }>('/java-helper/recommend-jvm-args', {
      method: 'POST',
      body: JSON.stringify({ jarPath, maxMemoryMb }),
    }),

  attach: (pid: string) =>
    apiFetch<{ success: boolean; data: any }>('/java-helper/attach', {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),

  sample: (kind: 'thread' | 'heap') =>
    apiFetch<{ success: boolean; data: ThreadSampleDto | HeapSampleDto }>('/java-helper/sample', {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),

  detach: () =>
    apiFetch<{ success: boolean }>('/java-helper/detach', { method: 'POST' }),

  startJfr: (input: { serverId: string; pid: string; durationSec?: number; settings?: 'default' | 'profile' }) =>
    apiFetch<{ success: boolean; data: JfrTask }>('/java-helper/jfr/start', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  stopJfr: (taskId: string) =>
    apiFetch<{ success: boolean; data: JfrTask }>('/java-helper/jfr/stop', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),

  listJfrTasks: (serverId?: string) =>
    apiFetch<{ success: boolean; data: JfrTask[] }>(
      `/java-helper/jfr/tasks${serverId ? `?serverId=${encodeURIComponent(serverId)}` : ''}`,
    ),

  cleanupJfr: (retentionDays: number) =>
    apiFetch<{ success: boolean; data: { deletedTasks: number; deletedFiles: number } }>('/java-helper/jfr/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retentionDays }),
    }),

  downloadJfrStream: async (taskId: string): Promise<Blob> => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/java-helper/jfr/download-stream?taskId=${encodeURIComponent(taskId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(`download failed: ${response.status}`);
    }
    return response.blob();
  },
} as const;

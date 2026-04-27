import { apiFetch } from './client.js';

export interface JvmProcess {
  pid: number;
  command: string;
  name?: string;
  mainClass?: string;
  user?: string;
  startTime?: string;
  uptimeSec?: number;
}

interface JvmApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
}

function unwrapJvmResponse<T>(payload: JvmApiEnvelope<T>, fallback: T): T {
  if (!payload.success) {
    throw new Error(payload.error ?? payload.message ?? 'JVM 接口请求失败');
  }
  return payload.data ?? fallback;
}

export const jvmApi = {
  async listProcesses(): Promise<JvmProcess[]> {
    const res = await apiFetch<JvmApiEnvelope<JvmProcess[]>>('/jvm/processes');
    return unwrapJvmResponse(res, []);
  },

  async attachToProcess(pid: number): Promise<void> {
    const res = await apiFetch<JvmApiEnvelope<unknown>>(`/jvm/attach/${pid}`, { method: 'POST' });
    unwrapJvmResponse(res, null);
  },

  async detachFromProcess(): Promise<void> {
    const res = await apiFetch<JvmApiEnvelope<unknown>>('/jvm/detach', { method: 'DELETE' });
    unwrapJvmResponse(res, null);
  },

  async getThreadSample(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/threads');
    return unwrapJvmResponse(res, null);
  },

  async getHeapSample(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/heap');
    return unwrapJvmResponse(res, null);
  },

  async getStatus(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/status');
    return unwrapJvmResponse(res, null);
  },

  async generateHeapDump(outputPath: string, liveObjectsOnly = true): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/heap-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputPath, liveObjectsOnly }),
    });
    return unwrapJvmResponse(res, null);
  },

  async generateThreadDump(outputPath: string, includeLockedMonitors = true, includeLockedSynchronizers = true): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/thread-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputPath, includeLockedMonitors, includeLockedSynchronizers }),
    });
    return unwrapJvmResponse(res, null);
  },

  async listDumps(): Promise<any[]> {
    const res = await apiFetch<JvmApiEnvelope<any[]>>('/jvm/dumps');
    return unwrapJvmResponse(res, []);
  },

  async downloadDump(filename: string): Promise<void> {
    window.open(`/api/jvm/dumps/${filename}`, '_blank');
  },

  async checkDiskSpace(path: string): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/check-disk-space', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return unwrapJvmResponse(res, null);
  },

  async estimateHeapSize(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/estimate-heap-size');
    return unwrapJvmResponse(res, null);
  },

  async shutdownJvm(pid: string, graceful: boolean, timeout?: number): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>(`/jvm/shutdown/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graceful, timeout }),
    });
    return unwrapJvmResponse(res, null);
  },

  async startJfrRecording(options?: { name?: string; durationSeconds?: number; maxSize?: number; maxAge?: number }): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/jfr/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    return unwrapJvmResponse(res, null);
  },

  async stopJfrRecording(recordingId: number, outputPath: string): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/jfr/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, outputPath }),
    });
    return unwrapJvmResponse(res, null);
  },

  async getJfrStatus(recordingId: number): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>(`/jvm/jfr/status/${recordingId}`);
    return unwrapJvmResponse(res, null);
  },

  async getJvmFlags(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/info/flags');
    return unwrapJvmResponse(res, null);
  },

  async getClassLoadingInfo(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/info/class-loading');
    return unwrapJvmResponse(res, null);
  },

  async getGcInfo(): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/info/gc');
    return unwrapJvmResponse(res, null);
  },

  async startCpuSampling(options?: { durationSeconds?: number; intervalMs?: number }): Promise<any> {
    const res = await apiFetch<JvmApiEnvelope<any>>('/jvm/cpu-sampling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    return unwrapJvmResponse(res, null);
  },
};

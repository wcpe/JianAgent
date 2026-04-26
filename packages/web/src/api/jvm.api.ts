import { apiFetch } from './client.js';

export interface JvmProcess {
  pid: number;
  command: string;
}

export const jvmApi = {
  async listProcesses(): Promise<JvmProcess[]> {
    const res = await apiFetch<{ success: boolean; data: JvmProcess[] }>('/api/v1/jvm/processes');
    return res.data || [];
  },

  async attachToProcess(pid: number): Promise<void> {
    await apiFetch(`/api/v1/jvm/attach/${pid}`, { method: 'POST' });
  },

  async detachFromProcess(): Promise<void> {
    await apiFetch('/api/v1/jvm/detach', { method: 'DELETE' });
  },

  async getThreadSample(): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/v1/jvm/threads');
    return res.data;
  },

  async getHeapSample(): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/v1/jvm/heap');
    return res.data;
  },

  async getStatus(): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/v1/jvm/status');
    return res.data;
  },
};

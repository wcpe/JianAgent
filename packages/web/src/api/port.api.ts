import { apiFetch } from './client.js';
import type { PortUsage } from '../types/port.types.js';

export const portApi = {
  async getAllPorts(): Promise<PortUsage[]> {
    const res = await apiFetch<{ success: boolean; data: PortUsage[] }>('/api/v1/ports');
    return res.data || [];
  },

  async getPortUsage(port: number): Promise<PortUsage | null> {
    const res = await apiFetch<{ success: boolean; data: PortUsage }>(`/api/v1/ports/${port}`);
    return res.data || null;
  },

  async checkPortByJvm(port: number): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any }>(`/api/v1/ports/check-jvm/${port}`);
    return res.data;
  },
};

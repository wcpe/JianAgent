import { apiFetch } from './client.js';
import type { PortUsage } from '../types/port.types.js';

type PortResponse =
  | readonly PortUsage[]
  | {
      readonly success?: boolean;
      readonly data?: readonly PortUsage[];
    };

interface PortApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
}

function unwrapPortResponse<T>(payload: PortApiEnvelope<T>, fallback: T): T {
  if (!payload.success) {
    throw new Error(payload.error ?? payload.message ?? '端口接口请求失败');
  }
  return payload.data ?? fallback;
}

export interface ClosePortResult {
  readonly attempted: number;
  readonly closed: number;
  readonly details: readonly string[];
}

export const portApi = {
  async getAllPorts(): Promise<PortUsage[]> {
    const res = await apiFetch<PortResponse>('/ports');
    if (Array.isArray(res)) {
      return [...res];
    }
    if ('data' in res && Array.isArray(res.data)) {
      return [...res.data];
    }
    return [];
  },

  async getPortUsage(port: number): Promise<PortUsage | null> {
    const res = await apiFetch<PortApiEnvelope<PortUsage | null>>(`/ports/${port}`);
    return unwrapPortResponse(res, null);
  },

  async checkPortByJvm(port: number): Promise<any> {
    const res = await apiFetch<PortApiEnvelope<any>>(`/ports/check-jvm/${port}`);
    return unwrapPortResponse(res, null);
  },

  async closePort(port: number): Promise<ClosePortResult> {
    const res = await apiFetch<PortApiEnvelope<ClosePortResult>>(`/ports/${port}/close`, { method: 'POST' });
    return unwrapPortResponse(res, { attempted: 0, closed: 0, details: [] });
  },
};

import { apiFetch } from './client.js';

export interface SessionSummaryUI {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly currentPhase?: string | null;
  readonly createdAt?: string;
}

export const sessionApi = {
  list: () =>
    apiFetch<{ success: boolean; data: SessionSummaryUI[] }>('/sessions'),

  getOne: (id: string) =>
    apiFetch<{ success: boolean; data: SessionSummaryUI }>(`/sessions/${encodeURIComponent(id)}`),

  create: (dto: { name: string; serverId: string; botConfigId: string; phases: readonly { phase: string; botCount: number; behavior: string; durationSec: number }[] }) =>
    apiFetch<{ success: boolean; data: SessionSummaryUI }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  start: (id: string) =>
    apiFetch<{ success: boolean }>(`/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' }),

  stop: (id: string) =>
    apiFetch<{ success: boolean }>(`/sessions/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
} as const;

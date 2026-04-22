import { apiFetch } from './client.js';

export interface PopulationRecord {
  readonly id: number;
  readonly serverId: string;
  readonly serverName: string;
  readonly timestamp: string;
  readonly onlinePlayers: number;
  readonly maxPlayers: number;
}

export const populationApi = {
  getHistory: async (params?: {
    serverId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<PopulationRecord[]> => {
    const query = new URLSearchParams();
    if (params?.serverId) query.set('serverId', params.serverId);
    if (params?.startTime) query.set('startTime', params.startTime);
    if (params?.endTime) query.set('endTime', params.endTime);
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const res = await apiFetch<{ success: boolean; data: PopulationRecord[] }>(`/population${qs ? `?${qs}` : ''}`);
    return res.data ?? [];
  },

  cleanup: async (days: number): Promise<number> => {
    const res = await apiFetch<{ success: boolean; deleted: number }>(`/population/retention?days=${days}`, { method: 'DELETE' });
    return res.deleted;
  },
};

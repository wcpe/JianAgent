import { apiFetch } from './client.js';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';

export const multiServerApi = {
  listServers: () =>
    apiFetch<ServerWithStatusDto[]>('/server-process/servers'),

  getActiveServer: () =>
    apiFetch<ServerWithStatusDto | null>('/server-process/servers/active'),

  activateServer: (id: string) =>
    apiFetch<{ success: boolean }>(
      `/server-process/servers/${encodeURIComponent(id)}/activate`,
      { method: 'POST' },
    ),
} as const;

import { apiFetch } from '../api/client.js';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';

export interface ConnectionInfo {
  readonly id: string;
  readonly serverId: string;
  readonly connectedAt: string;
  readonly protocolVersion: number;
}

export interface SnapshotResponse {
  readonly serverId: string;
  readonly snapshot: ProbeSnapshotDto;
  readonly receivedAt: string;
}

export interface CommandResponse {
  readonly requestId: string;
  readonly sent: boolean;
}

export const probeApi = {
  listConnections: () =>
    apiFetch<ConnectionInfo[]>('/plugin-bridge/connections'),

  getSnapshot: (serverId: string) =>
    apiFetch<SnapshotResponse>(`/plugin-bridge/snapshot/${serverId}`),

  getAllSnapshots: () =>
    apiFetch<SnapshotResponse[]>('/plugin-bridge/snapshots'),

  sendCommand: (serverId: string, action: string, params: Record<string, unknown> = {}) =>
    apiFetch<CommandResponse>(`/plugin-bridge/command/${serverId}`, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    }),

  executeConsole: (serverId: string, command: string) =>
    apiFetch<CommandResponse>(`/plugin-bridge/console/${serverId}`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  evalScript: (serverId: string, script: string) =>
    apiFetch<CommandResponse>(`/plugin-bridge/eval/${serverId}`, {
      method: 'POST',
      body: JSON.stringify({ script }),
    }),
} as const;

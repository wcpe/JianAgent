import { apiFetch } from './client.js';
import type { RemoteHostDto, CreateRemoteHostRequest, UpdateRemoteHostRequest } from '@jian-agent/shared-domain';

export const remoteHostApi = {
  list: () =>
    apiFetch<readonly RemoteHostDto[]>('/remote-hosts'),

  getById: (id: string) =>
    apiFetch<RemoteHostDto>(`/remote-hosts/${encodeURIComponent(id)}`),

  create: (req: CreateRemoteHostRequest) =>
    apiFetch<RemoteHostDto>('/remote-hosts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  testConnectionPreview: (req: CreateRemoteHostRequest | UpdateRemoteHostRequest) =>
    apiFetch<{ success: boolean; message: string }>('/remote-hosts/test-connection-preview', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  update: (id: string, req: UpdateRemoteHostRequest) =>
    apiFetch<RemoteHostDto>(`/remote-hosts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/remote-hosts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  testConnection: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/remote-hosts/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    }),

  sshConnect: (id: string) =>
    apiFetch<{ hostId: string; sshConfig: unknown }>(`/remote-hosts/${encodeURIComponent(id)}/ssh-connect`, {
      method: 'POST',
    }),
} as const;

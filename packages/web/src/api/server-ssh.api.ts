import { apiFetch } from './client.js';

export interface SshStatusResponse {
  readonly connected: boolean;
  readonly observability: {
    readonly totalActiveSessions: number;
    readonly perServerQuota: number;
    readonly activeSessionsForServer: number;
    readonly remainingSessionsForServer: number;
    readonly activeSessionIds: readonly string[];
    readonly activeSessionBriefIds: readonly string[];
  };
}

export interface SshSessionsResponse {
  readonly connected: boolean;
  readonly sessions: readonly {
    sessionId: string;
    sessionBriefId: string;
    serverId: string;
    openedAt: string;
    lastActivityAt: string;
    idleForMs: number;
    idleTimeoutMs: number;
  }[];
}

export const serverSshApi = {
  sshConnect: (id: string) =>
    apiFetch<{ success: boolean; sessionId: string }>(`/servers/${encodeURIComponent(id)}/ssh/connect`, {
      method: 'POST',
    }),

  sshDisconnect: (id: string, sessionId?: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/ssh/disconnect${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, {
      method: 'DELETE',
    }),

  sshTest: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/servers/${encodeURIComponent(id)}/ssh/test`, {
      method: 'POST',
    }),

  sshStatus: (id: string) =>
    apiFetch<SshStatusResponse>(`/servers/${encodeURIComponent(id)}/ssh/status`),

  sshSessions: (id: string) =>
    apiFetch<SshSessionsResponse>(`/servers/${encodeURIComponent(id)}/ssh/sessions`),
} as const;

import { apiFetch } from './client.js';
import type {
  DebugRecordingDto,
  DebugRecordingEventDto,
  TerminalAuditDto,
} from '@jian-agent/shared-domain';

export const terminalApi = {
  // --- Debug recordings ---
  listRecordings: (sessionId?: string) =>
    apiFetch<readonly DebugRecordingDto[]>(
      `/pty/recordings${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`,
    ),

  getRecordingEvents: (id: string, fromMs?: number) =>
    apiFetch<readonly DebugRecordingEventDto[]>(
      `/pty/recordings/${encodeURIComponent(id)}/events${fromMs != null ? `?fromMs=${fromMs}` : ''}`,
    ),

  deleteRecording: (id: string) =>
    apiFetch<{ success: boolean }>(
      `/pty/recordings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  startRecording: (sessionId: string, serverId: string) =>
    apiFetch<{ success: boolean; recordingId: string }>('/pty/recordings', {
      method: 'POST',
      body: JSON.stringify({ sessionId, serverId }),
    }),

  stopRecording: (serverId: string) =>
    apiFetch<{ success: boolean; recordingId: string | null }>(
      `/pty/recordings/stop`,
      {
        method: 'POST',
        body: JSON.stringify({ serverId }),
      },
    ),

  // --- Terminal audit ---
  getAuditLog: (params?: {
    serverId?: string;
    userId?: string;
    limit?: number;
    page?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.serverId) searchParams.set('serverId', params.serverId);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.page) searchParams.set('page', String(params.page));
    const qs = searchParams.toString();
    return apiFetch<readonly TerminalAuditDto[]>(
      `/pty/audit${qs ? `?${qs}` : ''}`,
    );
  },
} as const;

import { apiFetch } from './client.js';
import type {
  ConditionalStopDto,
  ConditionType,
  StartTemplateDto,
  CreateStartTemplateDto,
  UpdateStartTemplateDto,
} from '@jian-agent/shared-domain';

export const serverMonitoringApi = {
  // ── Scheduled Stop / Restart ──

  scheduleStop: (id: string, stopAt: string, mode: 'graceful' | 'force' = 'graceful') =>
    apiFetch<{ success: boolean; stopAt: string; mode: string }>(`/servers/${encodeURIComponent(id)}/scheduled-stop`, {
      method: 'POST',
      body: JSON.stringify({ stopAt, mode }),
    }),

  scheduleRestart: (id: string, restartAt: string) =>
    apiFetch<{ success: boolean; restartAt: string }>(`/servers/${encodeURIComponent(id)}/scheduled-restart`, {
      method: 'POST',
      body: JSON.stringify({ restartAt }),
    }),

  getScheduledStop: (id: string) =>
    apiFetch<{ stopAt: string; mode: string } | null>(`/servers/${encodeURIComponent(id)}/scheduled-stop`),

  cancelScheduledStop: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/scheduled-stop`, {
      method: 'DELETE',
    }),

  // ── Conditional Stop ──

  getConditionalStop: (id: string) =>
    apiFetch<ConditionalStopDto | null>(`/servers/${encodeURIComponent(id)}/conditional-stop`),

  setConditionalStop: (id: string, type: ConditionType, params: Record<string, number>) =>
    apiFetch<ConditionalStopDto>(`/servers/${encodeURIComponent(id)}/conditional-stop`, {
      method: 'PUT',
      body: JSON.stringify({ type, params }),
    }),

  clearConditionalStop: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/conditional-stop`, {
      method: 'DELETE',
    }),

  // ── Health Status ──

  getHealthStatus: (id: string) =>
    apiFetch<{ serverId: string; unresponsive: boolean; restartCount: number; monitoredServers: readonly string[] }>(
      `/servers/${encodeURIComponent(id)}/health`,
    ),

  // ── Start Templates ──

  listTemplates: () =>
    apiFetch<readonly StartTemplateDto[]>('/start-templates'),

  getTemplate: (templateId: string) =>
    apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(templateId)}`),

  createTemplate: (request: CreateStartTemplateDto) =>
    apiFetch<StartTemplateDto>('/start-templates', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateTemplate: (templateId: string, request: UpdateStartTemplateDto) =>
    apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(templateId)}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),

  deleteTemplate: (templateId: string) =>
    apiFetch<void>(`/start-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    }),

  // ── Config Snapshots ──

  listSnapshots: (id: string) =>
    apiFetch<Array<{ id: string; name: string; createdAt: string; createdBy: string }>>(
      `/servers/${encodeURIComponent(id)}/snapshots`
    ),

  getSnapshot: (id: string, snapId: string) =>
    apiFetch<{ id: string; serverId: string; name: string; configJson: string; createdAt: string; createdBy: string }>(
      `/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapId)}`
    ),

  restoreSnapshot: (id: string, snapId: string) =>
    apiFetch<{ success: boolean }>(
      `/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapId)}/restore`,
      { method: 'POST' }
    ),
} as const;

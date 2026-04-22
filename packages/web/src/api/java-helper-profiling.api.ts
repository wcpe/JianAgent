import { apiFetch } from './client.js';
import type { ProfilingResultDto, AutoAttachConfigDto, ExceptionEventDto } from '@jian-agent/shared-domain';

export const javaHelperProfilingApi = {
  startProfiling: (durationSeconds: number) =>
    apiFetch<{ success: boolean; data: ProfilingResultDto }>('/java-helper/profile-start', {
      method: 'POST',
      body: JSON.stringify({ durationSeconds }),
    }),

  stopProfiling: () =>
    apiFetch<{ success: boolean }>('/java-helper/profile-stop', {
      method: 'POST',
    }),

  getProfilingResult: () =>
    apiFetch<{ success: boolean; data: ProfilingResultDto | null }>('/java-helper/profile-result'),

  startExceptionMonitor: (filter?: string) =>
    apiFetch<{ success: boolean }>('/java-helper/exception-start', {
      method: 'POST',
      body: JSON.stringify({ filter: filter ?? null }),
    }),

  stopExceptionMonitor: () =>
    apiFetch<{ success: boolean; data: readonly ExceptionEventDto[] }>('/java-helper/exception-stop', {
      method: 'POST',
    }),

  getExceptionEvents: () =>
    apiFetch<{ success: boolean; data: readonly ExceptionEventDto[] }>('/java-helper/exception-list'),

  getAutoConfig: () =>
    apiFetch<{ success: boolean; data: AutoAttachConfigDto }>('/java-helper/auto-config'),

  setAutoConfig: (config: AutoAttachConfigDto) =>
    apiFetch<{ success: boolean }>('/java-helper/auto-config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),
} as const;

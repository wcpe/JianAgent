import { apiFetch } from './client.js';
import type {
  WorkerInfoDto,
  DistributionPlanDto,
  MigrateBotRequestDto,
  MigrationResultDto,
} from '@jian-agent/shared-domain';

export const workerApi = {
  listWorkers: (filter?: { readonly status?: string; readonly tag?: string }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.set('status', filter.status);
    if (filter?.tag) params.set('tag', filter.tag);
    const qs = params.toString();
    return apiFetch<WorkerInfoDto[]>(`/workers${qs ? `?${qs}` : ''}`);
  },

  getWorker: (id: string) =>
    apiFetch<WorkerInfoDto>(`/workers/${encodeURIComponent(id)}`),

  distributeBots: (totalBots: number) =>
    apiFetch<DistributionPlanDto>('/bot/distribute', {
      method: 'POST',
      body: JSON.stringify({ totalBots }),
    }),

  migrateBots: (req: MigrateBotRequestDto) =>
    apiFetch<MigrationResultDto>('/bot/migrate', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  setStrategy: (strategy: string) =>
    apiFetch<void>('/bot/strategy', {
      method: 'PATCH',
      body: JSON.stringify({ strategy }),
    }),
} as const;

import { apiFetch } from './client.js';
import type {
  ResourceDetailDto,
  ResourceWorkspaceListDto,
  ServerType,
} from '@jian-agent/shared-domain';

export interface ResourceWorkspaceQuery {
  readonly kind?: 'SERVER' | 'REMOTE_HOST';
  readonly serverType?: ServerType;
  readonly status?: string;
  readonly q?: string;
  readonly group?: string;
  readonly tag?: string;
  readonly page?: number;
  readonly limit?: number;
}

export const resourceApi = {
  list: (query: ResourceWorkspaceQuery = {}) => {
    const params = new URLSearchParams();
    if (query.kind) params.set('kind', query.kind);
    if (query.serverType) params.set('serverType', query.serverType);
    if (query.status) params.set('status', query.status);
    if (query.q) params.set('q', query.q);
    if (query.group) params.set('group', query.group);
    if (query.tag) params.set('tag', query.tag);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const suffix = params.toString();
    return apiFetch<ResourceWorkspaceListDto>(
      `/resources${suffix ? `?${suffix}` : ''}`,
    );
  },
  getDetail: (id: string) =>
    apiFetch<ResourceDetailDto>(`/resources/${encodeURIComponent(id)}`),
} as const;

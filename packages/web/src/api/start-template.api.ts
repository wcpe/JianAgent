import { apiFetch } from './client.js';
import type { StartTemplateDto, CreateStartTemplateDto, UpdateStartTemplateDto } from '@jian-agent/shared-domain';

export const startTemplateApi = {
  getAll: () => apiFetch<readonly StartTemplateDto[]>('/start-templates'),
  
  getById: (id: string) => apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(id)}`),
  
  create: (data: CreateStartTemplateDto) =>
    apiFetch<StartTemplateDto>('/start-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  update: (id: string, data: UpdateStartTemplateDto) =>
    apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    
  delete: (id: string) =>
    apiFetch<void>(`/start-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

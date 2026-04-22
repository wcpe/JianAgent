import { apiFetch } from './client.js';

export interface SessionTemplateDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly botConfig: string;
  readonly phases: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const sessionTemplateApi = {
  list: () =>
    apiFetch<{ success: boolean; data: SessionTemplateDto[] }>('/session-templates'),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: SessionTemplateDto }>(`/session-templates/${encodeURIComponent(id)}`),

  create: (dto: { name: string; description?: string; botConfig: Record<string, unknown>; phases: Record<string, unknown>[] }) =>
    apiFetch<{ success: boolean; data: SessionTemplateDto }>('/session-templates', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: { name?: string; description?: string; botConfig?: Record<string, unknown>; phases?: Record<string, unknown>[] }) =>
    apiFetch<{ success: boolean; data: SessionTemplateDto }>(`/session-templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/session-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createSession: (templateId: string) =>
    apiFetch<{ success: boolean; data: any }>(`/sessions/from-template/${encodeURIComponent(templateId)}`, { method: 'POST' }),
} as const;

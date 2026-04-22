import { apiFetch } from './client.js';
import type { JavaRuntimeDto, JavaRuntimeSelectionDto } from '@jian-agent/shared-domain';

export interface CreateJavaRuntimeRequest {
  readonly name: string;
  readonly home: string;
  readonly bin?: string;
  readonly isDefault?: boolean;
}

export const javaRuntimeApi = {
  /** List all registered Java runtimes */
  findAll: () =>
    apiFetch<JavaRuntimeDto[]>('/java-runtime'),

  /** Register a new Java runtime */
  create: (dto: CreateJavaRuntimeRequest) =>
    apiFetch<JavaRuntimeDto>('/java-runtime', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Remove a registered Java runtime */
  delete: (id: string) =>
    apiFetch<void>(`/java-runtime/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  /** Set a runtime as the default */
  setDefault: (id: string) =>
    apiFetch<JavaRuntimeDto>(`/java-runtime/${encodeURIComponent(id)}/default`, {
      method: 'PUT',
    }),

  /** Trigger runtime auto-discovery on the server */
  discover: () =>
    apiFetch<JavaRuntimeDto[]>('/java-runtime/discover', {
      method: 'POST',
    }),

  /** Resolve a runtimeId to the actual java path */
  resolve: (runtimeId: string) =>
    apiFetch<JavaRuntimeSelectionDto>(`/java-runtime/${encodeURIComponent(runtimeId)}/resolve`),
} as const;

import type { LogAggregateSearchResponseDto } from '@jian-agent/shared-domain';
import { apiFetch } from './client.js';

export const logsApi = {
  aggregateSearch: async (input: {
    query: string;
    serverIds?: readonly string[];
    maxPerServer?: number;
    maxTotal?: number;
    startTime?: string;
    endTime?: string;
    caseSensitive?: boolean;
    fields?: readonly ('content' | 'file')[];
  }): Promise<LogAggregateSearchResponseDto> => {
    const params = new URLSearchParams();
    params.set('q', input.query);
    if (input.serverIds && input.serverIds.length > 0) {
      params.set('serverIds', input.serverIds.join(','));
    }
    if (typeof input.maxPerServer === 'number') {
      params.set('maxPerServer', String(input.maxPerServer));
    }
    if (typeof input.maxTotal === 'number') {
      params.set('maxTotal', String(input.maxTotal));
    }
    if (input.startTime) {
      params.set('startTime', input.startTime);
    }
    if (input.endTime) {
      params.set('endTime', input.endTime);
    }
    if (typeof input.caseSensitive === 'boolean') {
      params.set('caseSensitive', String(input.caseSensitive));
    }
    if (input.fields && input.fields.length > 0) {
      params.set('fields', input.fields.join(','));
    }

    return apiFetch<LogAggregateSearchResponseDto>(`/logs/aggregate?${params.toString()}`);
  },

  recent: async (input?: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
  }): Promise<LogAggregateSearchResponseDto> => {
    const params = new URLSearchParams();
    if (input?.serverIds && input.serverIds.length > 0) {
      params.set('serverIds', input.serverIds.join(','));
    }
    if (typeof input?.linesPerServer === 'number') {
      params.set('linesPerServer', String(input.linesPerServer));
    }
    if (typeof input?.maxTotal === 'number') {
      params.set('maxTotal', String(input.maxTotal));
    }
    const qs = params.toString();
    return apiFetch<LogAggregateSearchResponseDto>(`/logs/recent${qs ? `?${qs}` : ''}`);
  },
} as const;

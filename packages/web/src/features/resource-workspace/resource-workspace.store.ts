import { create } from 'zustand';
import type {
  ResourceWorkspaceItemDto,
  ResourceWorkspaceSummaryDto,
  ServerType,
} from '@jian-agent/shared-domain';
import {
  resourceApi,
  type ResourceWorkspaceQuery,
} from '../../api/resource.api.js';

export type ResourceWorkspaceViewMode = 'card' | 'table';

export interface ResourceWorkspaceFilters {
  readonly kind?: 'SERVER' | 'REMOTE_HOST';
  readonly serverType?: ServerType;
  readonly status?: string;
  readonly q?: string;
  readonly group?: string;
  readonly tag?: string;
}

interface ResourceWorkspaceState {
  readonly items: readonly ResourceWorkspaceItemDto[];
  readonly summary: ResourceWorkspaceSummaryDto;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly filters: ResourceWorkspaceFilters;
  readonly viewMode: ResourceWorkspaceViewMode;
  readonly selectedIds: readonly string[];
  readonly loading: boolean;
  readonly error: string | null;
  load: () => Promise<void>;
  setFilters: (patch: Partial<ResourceWorkspaceFilters>) => void;
  replaceFilters: (next: ResourceWorkspaceFilters) => void;
  setViewMode: (mode: ResourceWorkspaceViewMode) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
}

const EMPTY_SUMMARY: ResourceWorkspaceSummaryDto = {
  total: 0,
  byKind: {},
  byStatus: {},
  byServerType: {},
};

function normalizeFilters(
  filters: ResourceWorkspaceFilters,
): ResourceWorkspaceQuery {
  return {
    kind: filters.kind,
    serverType: filters.serverType,
    status: filters.status || undefined,
    q: filters.q?.trim() || undefined,
    group: filters.group?.trim() || undefined,
    tag: filters.tag?.trim() || undefined,
  };
}

export const useResourceWorkspaceStore = create<ResourceWorkspaceState>(
  (set, get) => ({
    items: [],
    summary: EMPTY_SUMMARY,
    total: 0,
    page: 1,
    limit: 24,
    filters: {},
    viewMode: 'card',
    selectedIds: [],
    loading: false,
    error: null,

    load: async () => {
      const { filters, page, limit } = get();
      set({ loading: true, error: null });
      try {
        const result = await resourceApi.list({
          ...normalizeFilters(filters),
          page,
          limit,
        });
        set({
          items: Array.isArray(result?.items) ? result.items : [],
          summary: result.summary,
          total: result.total,
          page: result.page,
          limit: result.limit,
          loading: false,
          selectedIds: (get().selectedIds ?? []).filter((id) =>
            (result?.items ?? []).some((item) => item.summary.id === id),
          ),
        });
      } catch (error) {
        set({
          loading: false,
          error: error instanceof Error ? error.message : '加载资源工作台失败',
        });
      }
    },

    setFilters: (patch) =>
      set((state) => ({
        filters: {
          ...state.filters,
          ...patch,
        },
        page: 1,
        selectedIds: [],
      })),

    replaceFilters: (next) =>
      set({
        filters: next,
        page: 1,
        selectedIds: [],
      }),

    setViewMode: (mode) => set({ viewMode: mode }),

    toggleSelected: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((entry) => entry !== id)
          : [...state.selectedIds, id],
      })),

    clearSelection: () => set({ selectedIds: [] }),
  }),
);

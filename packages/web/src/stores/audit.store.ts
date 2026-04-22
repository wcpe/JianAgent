import { create } from 'zustand';
import { auditApi } from '../api/audit.api.js';
import type { AuditRecord, AuditQueryParams } from '@jian-agent/shared-domain';

interface AuditState {
  readonly records: readonly AuditRecord[];
  readonly total: number;
  readonly filters: AuditQueryParams;
  readonly loading: boolean;
  readonly error: string | null;
  fetchRecords: () => Promise<void>;
  setFilters: (f: Partial<AuditQueryParams>) => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  records: [],
  total: 0,
  filters: { page: 1, limit: 20 },
  loading: false,
  error: null,

  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const result = await auditApi.list(get().filters);
      set({ records: result.items, total: result.total, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Failed to fetch audit records' });
    }
  },

  setFilters: (f) =>
    set((prev) => ({ filters: { ...prev.filters, ...f } })),
}));

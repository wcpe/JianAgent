import { create } from 'zustand';
import type { JavaHelperStatusDto, ThreadSampleDto, HeapSampleDto } from '@jian-agent/shared-domain';
import { javaHelperApi } from '../api/java-helper.api.js';

interface JavaHelperStoreState {
  readonly status: JavaHelperStatusDto | null;
  readonly lastThreadSample: ThreadSampleDto | null;
  readonly lastHeapSample: HeapSampleDto | null;
  readonly loading: boolean;
  readonly error: string | null;
  fetchStatus: () => Promise<void>;
  setStatus: (s: JavaHelperStatusDto) => void;
  setThreadSample: (s: ThreadSampleDto) => void;
  setHeapSample: (s: HeapSampleDto) => void;
}

export const useJavaHelperStore = create<JavaHelperStoreState>((set) => ({
  status: null,
  lastThreadSample: null,
  lastHeapSample: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const res = await javaHelperApi.getStatus();
      set({ status: res.data, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },

  setStatus: (s) => set({ status: s }),
  setThreadSample: (s) => set({ lastThreadSample: s }),
  setHeapSample: (s) => set({ lastHeapSample: s }),
}));

import { create } from 'zustand';
import { validationApi } from '../../api/validation.api.js';
import type {
  ValidationPlanDto,
  ValidationRunDto,
  ValidationVerdictDto,
} from '@jian-agent/shared-domain';
import type { ObservabilitySummaryDto } from '../../api/validation.api.js';

export type ValidationMode = 'quick' | 'template' | 'post-ops';
export type RunView = 'idle' | 'running' | 'verdict';

interface ValidationState {
  // Mode selection
  mode: ValidationMode;
  setMode: (mode: ValidationMode) => void;

  // Plans (for template mode)
  plans: ValidationPlanDto[];
  plansLoading: boolean;
  loadPlans: () => Promise<void>;

  // Active run
  activeRun: ValidationRunDto | null;
  runView: RunView;
  startQuick: (serverId: string, name?: string, botCount?: number, durationSec?: number) => Promise<void>;
  startPlan: (planId: string) => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;

  // Verdict
  verdict: ValidationVerdictDto | null;
  observability: ObservabilitySummaryDto | null;
  loadVerdict: (runId: string) => Promise<void>;

  // Run history
  runs: ValidationRunDto[];
  loadRuns: (planId?: string) => Promise<void>;

  // Reset
  reset: () => void;
}

export const useValidationStore = create<ValidationState>((set, get) => ({
  mode: 'quick',
  setMode: (mode) => set({ mode }),

  plans: [],
  plansLoading: false,
  loadPlans: async () => {
    set({ plansLoading: true });
    try {
      const res = await validationApi.listPlans();
      set({ plans: res.data, plansLoading: false });
    } catch {
      set({ plansLoading: false });
    }
  },

  activeRun: null,
  runView: 'idle',
  startQuick: async (serverId, name, botCount, durationSec) => {
    set({ runView: 'running', verdict: null, observability: null });
    try {
      const res = await validationApi.quickValidate({ serverId, name, botCount, durationSec });
      set({ activeRun: res.data });
    } catch (err: unknown) {
      set({ runView: 'idle' });
      throw err;
    }
  },
  startPlan: async (planId) => {
    set({ runView: 'running', verdict: null, observability: null });
    try {
      const res = await validationApi.startRun(planId);
      set({ activeRun: res.data });
    } catch (err: unknown) {
      set({ runView: 'idle' });
      throw err;
    }
  },
  cancelRun: async (runId) => {
    await validationApi.cancelRun(runId);
    await get().refreshRun(runId);
  },
  refreshRun: async (runId) => {
    try {
      const res = await validationApi.getRun(runId);
      set({ activeRun: res.data });
      if (res.data.status === 'completed' || res.data.status === 'failed') {
        set({ runView: 'verdict' });
        await get().loadVerdict(runId);
      }
    } catch { /* ignore */ }
  },

  verdict: null,
  observability: null,
  loadVerdict: async (runId) => {
    try {
      const [vRes, oRes] = await Promise.all([
        validationApi.getVerdictByRunId(runId),
        validationApi.getObservabilitySummary(runId),
      ]);
      set({ verdict: vRes.data ?? null, observability: oRes.data });
    } catch { /* ignore */ }
  },

  runs: [],
  loadRuns: async (planId) => {
    try {
      const res = await validationApi.listRuns(planId);
      set({ runs: res.data });
    } catch { /* ignore */ }
  },

  reset: () => set({
    activeRun: null,
    runView: 'idle',
    verdict: null,
    observability: null,
  }),
}));

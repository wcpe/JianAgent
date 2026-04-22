import { create } from 'zustand';
import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationScenarioPackDto,
  LocalValidationStageDto,
} from '../../api/local-validation.api.js';
import { localValidationApi, type CreateLocalValidationRunRequest } from '../../api/local-validation.api.js';

interface LocalValidationLoadingState {
  readonly scenarioPacks: boolean;
  readonly runs: boolean;
  readonly activeRun: boolean;
  readonly artifacts: boolean;
  readonly createRun: boolean;
  readonly startRun: boolean;
  readonly cancelRun: boolean;
}

interface LocalValidationState {
  readonly scenarioPacks: LocalValidationScenarioPackDto[];
  readonly runs: LocalValidationRunDto[];
  readonly activeRun: LocalValidationRunDto | null;
  readonly stages: LocalValidationStageDto[];
  readonly assertions: LocalValidationAssertionDto[];
  readonly evidence: LocalValidationEvidenceDto[];
  readonly selectedRunId: string | null;
  readonly artifactRequestId: number;
  readonly loading: LocalValidationLoadingState;
  readonly error: string | null;
  loadScenarioPacks: () => Promise<void>;
  loadRuns: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;
  createRun: (dto: CreateLocalValidationRunRequest) => Promise<LocalValidationRunDto>;
  startRun: (runId: string) => Promise<LocalValidationRunDto>;
  cancelRun: (runId: string) => Promise<LocalValidationRunDto>;
  loadRunArtifacts: (runId: string) => Promise<void>;
}

const DEFAULT_LOADING: LocalValidationLoadingState = {
  scenarioPacks: false,
  runs: false,
  activeRun: false,
  artifacts: false,
  createRun: false,
  startRun: false,
  cancelRun: false,
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

function upsertRun(runs: readonly LocalValidationRunDto[], run: LocalValidationRunDto): LocalValidationRunDto[] {
  const index = runs.findIndex((item) => item.id === run.id);
  if (index < 0) {
    return [run, ...runs];
  }

  const next = runs.slice();
  next[index] = run;
  return next;
}

function resolveSelectedRun(
  selectedRunId: string | null,
  runs: readonly LocalValidationRunDto[],
  activeRun: LocalValidationRunDto | null,
): LocalValidationRunDto | null {
  if (selectedRunId) {
    return runs.find((run) => run.id === selectedRunId) ?? activeRun;
  }
  return activeRun;
}

export const useLocalValidationStore = create<LocalValidationState>((set, get) => ({
  scenarioPacks: [],
  runs: [],
  activeRun: null,
  stages: [],
  assertions: [],
  evidence: [],
  selectedRunId: null,
  artifactRequestId: 0,
  loading: DEFAULT_LOADING,
  error: null,

  loadScenarioPacks: async () => {
    set((state) => ({
      loading: { ...state.loading, scenarioPacks: true },
      error: null,
    }));

    try {
      const packs = await localValidationApi.listScenarioPacks();
      set((state) => ({
        scenarioPacks: packs,
        loading: { ...state.loading, scenarioPacks: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, scenarioPacks: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  loadRuns: async () => {
    set((state) => ({
      loading: { ...state.loading, runs: true },
      error: null,
    }));

    try {
      const runs = await localValidationApi.listRuns();
      set((state) => ({
        runs,
        activeRun: resolveSelectedRun(state.selectedRunId, runs, state.activeRun),
        loading: { ...state.loading, runs: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, runs: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  selectRun: async (runId: string) => {
    set((state) => ({
      selectedRunId: runId,
      loading: { ...state.loading, activeRun: true },
      error: null,
    }));

    const existingRun = get().runs.find((run) => run.id === runId);
    if (existingRun) {
      set((state) => ({
        activeRun: existingRun,
        stages: [],
        assertions: [],
        evidence: [],
        loading: { ...state.loading, activeRun: false },
      }));
      return;
    }

    try {
      const run = await localValidationApi.getRun(runId);
      set((state) => ({
        runs: upsertRun(state.runs, run),
        activeRun: run,
        stages: [],
        assertions: [],
        evidence: [],
        loading: { ...state.loading, activeRun: false },
      }));
    } catch (error) {
      set((state) => ({
        activeRun: null,
        loading: { ...state.loading, activeRun: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  createRun: async (dto: CreateLocalValidationRunRequest) => {
    set((state) => ({
      loading: { ...state.loading, createRun: true },
      error: null,
    }));

    try {
      const run = await localValidationApi.createRun(dto);
      set((state) => ({
        runs: upsertRun(state.runs, run),
        activeRun: run,
        selectedRunId: run.id,
        loading: { ...state.loading, createRun: false },
      }));
      return run;
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, createRun: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  startRun: async (runId: string) => {
    set((state) => ({
      loading: { ...state.loading, startRun: true },
      error: null,
    }));

    try {
      const run = await localValidationApi.startRun(runId);
      set((state) => ({
        runs: upsertRun(state.runs, run),
        activeRun: state.selectedRunId === run.id || state.activeRun?.id === run.id ? run : state.activeRun,
        selectedRunId: state.selectedRunId ?? run.id,
        loading: { ...state.loading, startRun: false },
      }));
      return run;
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, startRun: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  cancelRun: async (runId: string) => {
    set((state) => ({
      loading: { ...state.loading, cancelRun: true },
      error: null,
    }));

    try {
      const run = await localValidationApi.cancelRun(runId);
      set((state) => ({
        runs: upsertRun(state.runs, run),
        activeRun: state.selectedRunId === run.id || state.activeRun?.id === run.id ? run : state.activeRun,
        loading: { ...state.loading, cancelRun: false },
      }));
      return run;
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, cancelRun: false },
        error: toErrorMessage(error),
      }));
      throw error;
    }
  },

  loadRunArtifacts: async (runId: string) => {
    const requestId = get().artifactRequestId + 1;
    set((state) => ({
      stages: [],
      assertions: [],
      evidence: [],
      loading: { ...state.loading, artifacts: true, activeRun: true },
      selectedRunId: runId,
      artifactRequestId: requestId,
      error: null,
    }));

    try {
      const [stages, assertions, evidence] = await Promise.all([
        localValidationApi.loadRunStages(runId),
        localValidationApi.loadRunAssertions(runId),
        localValidationApi.loadRunEvidence(runId),
      ]);

      set((state) => ({
        ...(state.selectedRunId !== runId || state.artifactRequestId !== requestId
          ? {}
          : {
        stages,
        assertions,
        evidence,
        activeRun: resolveSelectedRun(runId, state.runs, state.activeRun),
        loading: { ...state.loading, artifacts: false, activeRun: false },
          }),
      }));
    } catch (error) {
      set((state) => ({
        ...(state.selectedRunId !== runId || state.artifactRequestId !== requestId
          ? {}
          : {
        stages: [],
        assertions: [],
        evidence: [],
        loading: { ...state.loading, artifacts: false, activeRun: false },
        error: toErrorMessage(error),
          }),
      }));
      throw error;
    }
  },
}));

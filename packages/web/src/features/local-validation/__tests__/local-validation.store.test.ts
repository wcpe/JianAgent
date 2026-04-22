import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationScenarioPackDto,
  LocalValidationStageDto,
} from '../../../api/local-validation.api.js';

vi.mock('../../../api/local-validation.api.js', () => ({
  localValidationApi: {
    listScenarioPacks: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    createRun: vi.fn(),
    startRun: vi.fn(),
    cancelRun: vi.fn(),
    loadRunStages: vi.fn(),
    loadRunAssertions: vi.fn(),
    loadRunEvidence: vi.fn(),
  },
}));

import { localValidationApi } from '../../../api/local-validation.api.js';
import { useLocalValidationStore } from '../local-validation.store.js';

const mockedApi = vi.mocked(localValidationApi);

const scenarioPack: LocalValidationScenarioPackDto = {
  id: 'combat-pack-v1',
  name: '综合对抗验收包',
  description: 'Local validation combat pack',
  stages: [
    {
      key: 'precheck',
      behaviorTemplate: 'idle',
      durationSec: 45,
      threshold: 1,
    },
  ],
};

const initialRun: LocalValidationRunDto = {
  id: 'lvr_001',
  name: 'Paper smoke',
  mode: 'init-paper',
  status: 'CREATED',
  scenarioPackId: 'combat-pack-v1',
  requestedBotCount: 8,
  effectiveBotCount: 0,
  requestedBy: 'qa',
  keepServerRunning: false,
  keepWorkspace: false,
  workspacePath: '/tmp/jianagent/lvr_001',
};

const startedRun: LocalValidationRunDto = {
  ...initialRun,
  status: 'RUNNING_SCENARIO',
  effectiveBotCount: 8,
  startedAt: '2026-04-19T10:00:00.000Z',
};

const stage: LocalValidationStageDto = {
  id: 'lvs_001',
  runId: 'lvr_001',
  stageKey: 'precheck',
  title: 'Precheck the local workspace',
  status: 'passed',
  timeoutMs: 120000,
  botGroupSnapshot: [
    {
      name: 'alpha',
      botNames: ['bot-a', 'bot-b'],
    },
  ],
  assertionSummary: {
    total: 1,
    passed: 1,
    failed: 0,
  },
  startedAt: '2026-04-19T10:00:05.000Z',
  finishedAt: '2026-04-19T10:01:05.000Z',
};

const assertion: LocalValidationAssertionDto = {
  id: 'lva_001',
  runId: 'lvr_001',
  stageId: 'lvs_001',
  key: 'server-ready',
  title: 'Server reports ready',
  required: true,
  status: 'passed',
  threshold: 1,
  actual: 1,
  message: 'Server reached the ready state',
  evidenceRefs: ['lve_001'],
};

const evidence: LocalValidationEvidenceDto = {
  id: 'lve_001',
  runId: 'lvr_001',
  kind: 'server-log',
  timestamp: '2026-04-19T10:00:07.000Z',
  summary: 'Paper logged the ready banner',
  payload: {
    line: '[Server thread/INFO]: Done (3.1s)!',
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocalValidationStore.setState(useLocalValidationStore.getInitialState(), true);
});

describe('useLocalValidationStore', () => {
  it('loads scenario packs, runs, and selects a run from the local list', async () => {
    mockedApi.listScenarioPacks.mockResolvedValue([scenarioPack]);
    mockedApi.listRuns.mockResolvedValue([initialRun, startedRun]);

    await useLocalValidationStore.getState().loadScenarioPacks();
    await useLocalValidationStore.getState().loadRuns();
    await useLocalValidationStore.getState().selectRun('lvr_001');

    const state = useLocalValidationStore.getState();
    expect(state.scenarioPacks).toHaveLength(1);
    expect(state.runs).toHaveLength(2);
    expect(state.selectedRunId).toBe('lvr_001');
    expect(state.activeRun?.id).toBe('lvr_001');
    expect(state.loading.scenarioPacks).toBe(false);
    expect(state.loading.runs).toBe(false);
    expect(state.error).toBeNull();
  });

  it('creates, starts, cancels, and loads run artifacts through the api', async () => {
    mockedApi.createRun.mockResolvedValue(initialRun);
    mockedApi.startRun.mockResolvedValue(startedRun);
    mockedApi.cancelRun.mockResolvedValue({
      ...startedRun,
      status: 'CANCELLED',
      finishedAt: '2026-04-19T10:10:00.000Z',
    });
    mockedApi.loadRunStages.mockResolvedValue([stage]);
    mockedApi.loadRunAssertions.mockResolvedValue([assertion]);
    mockedApi.loadRunEvidence.mockResolvedValue([evidence]);

    await useLocalValidationStore.getState().createRun({
      name: initialRun.name,
      mode: initialRun.mode,
      scenarioPackId: initialRun.scenarioPackId,
      requestedBotCount: initialRun.requestedBotCount,
      keepServerRunning: initialRun.keepServerRunning,
      keepWorkspace: initialRun.keepWorkspace,
      paperVersion: '1.21.1',
    });
    await useLocalValidationStore.getState().startRun('lvr_001');
    await useLocalValidationStore.getState().cancelRun('lvr_001');
    await useLocalValidationStore.getState().loadRunArtifacts('lvr_001');

    const state = useLocalValidationStore.getState();
    expect(state.runs[0]?.status).toBe('CANCELLED');
    expect(state.activeRun?.status).toBe('CANCELLED');
    expect(state.stages).toEqual([stage]);
    expect(state.assertions).toEqual([assertion]);
    expect(state.evidence).toEqual([evidence]);
    expect(state.loading.createRun).toBe(false);
    expect(state.loading.startRun).toBe(false);
    expect(state.loading.cancelRun).toBe(false);
    expect(state.loading.artifacts).toBe(false);
  });

  it('records an error when loading scenario packs fails', async () => {
    mockedApi.listScenarioPacks.mockRejectedValue(new Error('network down'));

    await expect(useLocalValidationStore.getState().loadScenarioPacks()).rejects.toThrow('network down');

    const state = useLocalValidationStore.getState();
    expect(state.loading.scenarioPacks).toBe(false);
    expect(state.error).toContain('network down');
  });

  it('ignores stale artifact responses after the selected run changes', async () => {
    const runTwo: LocalValidationRunDto = {
      ...initialRun,
      id: 'lvr_002',
      name: 'Paper soak',
    };
    useLocalValidationStore.setState({
      runs: [initialRun, runTwo],
    });

    const staleStages = deferred<LocalValidationStageDto[]>();
    const staleAssertions = deferred<LocalValidationAssertionDto[]>();
    const staleEvidence = deferred<LocalValidationEvidenceDto[]>();

    mockedApi.loadRunStages.mockImplementation((runId: string) => (
      runId === 'lvr_001'
        ? staleStages.promise
        : Promise.resolve([{ ...stage, id: 'lvs_002', runId, stageKey: 'spawn-and-stabilize', title: 'Spawn and Stabilize' }])
    ));
    mockedApi.loadRunAssertions.mockImplementation((runId: string) => (
      runId === 'lvr_001'
        ? staleAssertions.promise
        : Promise.resolve([{ ...assertion, id: 'lva_002', runId, stageId: 'lvs_002', title: 'Spawn ratio' }])
    ));
    mockedApi.loadRunEvidence.mockImplementation((runId: string) => (
      runId === 'lvr_001'
        ? staleEvidence.promise
        : Promise.resolve([{ ...evidence, id: 'lve_002', runId, summary: 'Spawn completed' }])
    ));

    const staleRequest = useLocalValidationStore.getState().loadRunArtifacts('lvr_001');
    const freshRequest = useLocalValidationStore.getState().loadRunArtifacts('lvr_002');

    staleStages.resolve([stage]);
    staleAssertions.resolve([assertion]);
    staleEvidence.resolve([evidence]);

    await Promise.all([staleRequest, freshRequest]);

    const state = useLocalValidationStore.getState();
    expect(state.selectedRunId).toBe('lvr_002');
    expect(state.stages[0]?.runId).toBe('lvr_002');
    expect(state.assertions[0]?.runId).toBe('lvr_002');
    expect(state.evidence[0]?.runId).toBe('lvr_002');
  });

  it('clears stale artifacts when the current run artifact request fails', async () => {
    useLocalValidationStore.setState({
      runs: [initialRun],
      selectedRunId: 'lvr_001',
      stages: [stage],
      assertions: [assertion],
      evidence: [evidence],
    });

    mockedApi.loadRunStages.mockRejectedValue(new Error('artifact timeout'));
    mockedApi.loadRunAssertions.mockResolvedValue([assertion]);
    mockedApi.loadRunEvidence.mockResolvedValue([evidence]);

    await expect(useLocalValidationStore.getState().loadRunArtifacts('lvr_001')).rejects.toThrow('artifact timeout');

    const state = useLocalValidationStore.getState();
    expect(state.stages).toEqual([]);
    expect(state.assertions).toEqual([]);
    expect(state.evidence).toEqual([]);
    expect(state.error).toContain('artifact timeout');
  });
});

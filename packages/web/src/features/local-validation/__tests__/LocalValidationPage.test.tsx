/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LocalValidationPage } from '../LocalValidationPage.js';

const mockLoadScenarioPacks = vi.fn().mockResolvedValue(undefined);
const mockLoadRuns = vi.fn().mockResolvedValue(undefined);
const mockSelectRun = vi.fn().mockResolvedValue(undefined);
const mockCreateRun = vi.fn().mockResolvedValue({ id: 'lvr_001' });
const mockStartRun = vi.fn().mockResolvedValue(undefined);
const mockCancelRun = vi.fn().mockResolvedValue(undefined);
const mockLoadRunArtifacts = vi.fn().mockResolvedValue(undefined);

const storeState = {
  scenarioPacks: [{
    id: 'combat-pack-v1',
    name: '综合对抗验收包',
    description: '覆盖出生、移动、聊天、交互、PvP、死亡、重生',
    stages: [],
  }],
  runs: [{
    id: 'lvr_001',
    name: 'Paper smoke',
    mode: 'init-paper',
    status: 'CREATED',
    scenarioPackId: 'combat-pack-v1',
    requestedBotCount: 8,
    effectiveBotCount: 0,
    requestedBy: 'qa',
    keepServerRunning: false,
    keepWorkspace: true,
    workspacePath: '/tmp/jianagent/lvr_001',
  }],
  activeRun: null,
  stages: [],
  assertions: [],
  evidence: [],
  selectedRunId: null,
  loading: {
    scenarioPacks: false,
    runs: false,
    activeRun: false,
    artifacts: false,
    createRun: false,
    startRun: false,
    cancelRun: false,
  },
  error: null,
  loadScenarioPacks: mockLoadScenarioPacks,
  loadRuns: mockLoadRuns,
  selectRun: mockSelectRun,
  createRun: mockCreateRun,
  startRun: mockStartRun,
  cancelRun: mockCancelRun,
  loadRunArtifacts: mockLoadRunArtifacts,
};

vi.mock('../local-validation.store.js', () => ({
  useLocalValidationStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('../../../ws/use-ws-channel.js', () => ({
  useWsChannel: vi.fn(),
}));

describe('LocalValidationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the local validation workspace shell', async () => {
    render(
      <MemoryRouter>
        <LocalValidationPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('本地验证运行台')).toBeTruthy();
    expect(screen.getByText('综合对抗验收包')).toBeTruthy();
    expect(screen.getByText('阶段时间线')).toBeTruthy();
    expect(screen.getByText('证据抽屉')).toBeTruthy();

    await waitFor(() => {
      expect(mockLoadScenarioPacks).toHaveBeenCalled();
      expect(mockLoadRuns).toHaveBeenCalled();
    });
  });
});

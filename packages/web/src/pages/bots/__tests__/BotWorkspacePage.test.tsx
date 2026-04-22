/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BotWorkspacePage } from '../BotWorkspacePage.js';

const {
  mockNavigate,
  mockFetchServers,
  mockFetchBots,
  mockFetchStats,
  mockSetFilter,
  mockSelectBot,
  mockStopBot,
  mockStopAll,
  mockShowToast,
  mockConfirm,
  mockBatchDelete,
  mockBatchExecuteScript,
  mockListSavedConfigs,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockFetchServers: vi.fn(),
  mockFetchBots: vi.fn(),
  mockFetchStats: vi.fn(),
  mockSetFilter: vi.fn(),
  mockSelectBot: vi.fn(),
  mockStopBot: vi.fn().mockResolvedValue(undefined),
  mockStopAll: vi.fn().mockResolvedValue(undefined),
  mockShowToast: vi.fn(),
  mockConfirm: vi.fn().mockResolvedValue(true),
  mockBatchDelete: vi.fn().mockResolvedValue({ success: true }),
  mockBatchExecuteScript: vi.fn().mockResolvedValue({ success: true, data: [] }),
  mockListSavedConfigs: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

const botStoreState = {
  bots: [{
    name: 'bot-1',
    state: 'online',
    currentBehavior: 'idle',
    workerPid: 123,
    serverId: 'srv-1',
    batchId: 'batch-1',
    x: 0,
    y: 64,
    z: 0,
    health: 20,
    food: 20,
    latencyMs: 0,
    world: 'world',
    isDead: false,
    deathCount: 0,
    connectedAt: null,
    lastError: null,
    lastHeartbeat: Date.now(),
  }],
  stats: { total: 1, online: 1, offline: 0, error: 0 },
  loading: false,
  error: null,
  filter: { page: 1, limit: 200 },
  meta: null,
  fetchBots: mockFetchBots,
  fetchStats: mockFetchStats,
  setFilter: mockSetFilter,
  selectBot: mockSelectBot,
  stopBot: mockStopBot,
  stopAll: mockStopAll,
};

const serverStoreState = {
  servers: [{
    id: 'srv-1',
    name: 'Server One',
    serverType: 'managed',
    runtimeStatus: 'running',
  }],
  fetchServers: mockFetchServers,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../stores/bot.store.js', () => ({
  useBotStore: (selector?: (state: typeof botStoreState) => unknown) =>
    selector ? selector(botStoreState) : botStoreState,
}));

vi.mock('../../../stores/server.store.js', () => ({
  useServerStore: (selector: (state: typeof serverStoreState) => unknown) => selector(serverStoreState),
}));

vi.mock('../../../stores/dialog.store.js', () => ({
  useDialogStore: Object.assign(
    (selector: (state: { showToast: typeof mockShowToast }) => unknown) =>
      selector({ showToast: mockShowToast }),
    {
      getState: () => ({
        showToast: mockShowToast,
        confirm: mockConfirm,
      }),
    },
  ),
}));

vi.mock('../../../api/bot.api.js', () => ({
  botApi: {
    batchDelete: mockBatchDelete,
    batchExecuteScript: mockBatchExecuteScript,
    listSavedConfigs: mockListSavedConfigs,
    batchStop: vi.fn().mockResolvedValue({ success: true }),
    batchReconnect: vi.fn().mockResolvedValue({ success: true, data: [] }),
    batchBehavior: vi.fn().mockResolvedValue({ success: true, data: [] }),
    deleteSavedConfig: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../BotStatsBar.js', () => ({
  BotStatsBar: () => <div>stats-bar</div>,
}));

vi.mock('../BotTable.js', () => ({
  BotTable: () => <div>bot-table</div>,
}));

vi.mock('../BotCardGrid.js', () => ({
  BotCardGrid: ({ onToggleSelect }: { onToggleSelect: (name: string) => void }) => (
    <button type="button" onClick={() => onToggleSelect('bot-1')}>
      select-bot-1
    </button>
  ),
}));

vi.mock('../CreateBotDrawer.js', () => ({
  CreateBotDrawer: () => null,
}));

vi.mock('../BotChatPanel.js', () => ({
  BotChatPanel: () => <div>chat-panel</div>,
}));

vi.mock('../../../components/EmptyState.js', () => ({
  EmptyState: () => <div>empty-state</div>,
}));

vi.mock('../../../components/ErrorState.js', () => ({
  ErrorState: () => <div>error-state</div>,
}));

describe('BotWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows batch delete and batch execute script actions for selected bots', async () => {
    render(
      <MemoryRouter>
        <BotWorkspacePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'select-bot-1' }));

    expect(await screen.findByRole('button', { name: '批量执行脚本' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '批量删除' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '批量执行脚本' }));
    await waitFor(() => {
      expect(mockBatchExecuteScript).toHaveBeenCalledWith(['bot-1'], expect.objectContaining({ id: expect.any(String) }));
    });

    fireEvent.click(screen.getByRole('button', { name: '批量删除' }));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockBatchDelete).toHaveBeenCalledWith(['bot-1']);
    });
  });
});

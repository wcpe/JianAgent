/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'mc-1' }),
  useNavigate: () => mockNavigate,
}));

// Mock API client to prevent real fetch calls
vi.mock('../../../api/client.js', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    snapshot: {
      tps: 19.5,
      mspt: 35.2,
      onlinePlayers: 5,
      maxPlayers: 20,
      loadedChunks: 250,
      entityCount: 1200,
      freeMemoryMb: 1024,
      totalMemoryMb: 4096,
      uptime: '3d 2h',
    },
  }),
}));

// Mock ws channel
vi.mock('../../../ws/use-ws-channel.js', () => ({
  useWsChannel: vi.fn(),
}));

// Mock child panels
vi.mock('../PlayerListPanel.js', () => ({
  PlayerListPanel: () => <div data-testid="player-list-panel">PlayerListPanel</div>,
}));
vi.mock('../PluginSnapshotPanel.js', () => ({
  PluginSnapshotPanel: () => <div data-testid="plugin-snapshot-panel">PluginSnapshotPanel</div>,
}));
vi.mock('../WorldInspectorPanel.js', () => ({
  WorldInspectorPanel: () => <div data-testid="world-inspector-panel">WorldInspectorPanel</div>,
}));
vi.mock('../ProbeConsolePanel.js', () => ({
  ProbeConsolePanel: () => <div data-testid="probe-console-panel">ProbeConsolePanel</div>,
}));

import { MinecraftDrillDownPage } from '../MinecraftDrillDownPage.js';
import { apiFetch } from '../../../api/client.js';

const mockApiFetch = vi.mocked(apiFetch);

describe('MinecraftDrillDownPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<MinecraftDrillDownPage />);
    expect(container).toBeTruthy();
  });

  it('displays the page title', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('Minecraft 深度钻取').length).toBeGreaterThan(0);
  });

  it('displays the server id', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('mc-1').length).toBeGreaterThan(0);
  });

  it('renders tab buttons', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('在线玩家').length).toBeGreaterThan(0);
    expect(screen.getAllByText('插件快照').length).toBeGreaterThan(0);
    expect(screen.getAllByText('世界详情').length).toBeGreaterThan(0);
    expect(screen.getAllByText('探针控制台').length).toBeGreaterThan(0);
  });

  it('renders the default players panel', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByTestId('player-list-panel').length).toBeGreaterThan(0);
  });

  it('renders navigation back button', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('← 返回').length).toBeGreaterThan(0);
  });

  it('renders refresh button', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('刷新快照').length).toBeGreaterThan(0);
  });

  it('calls apiFetch for snapshot on mount', () => {
    render(<MinecraftDrillDownPage />);
    expect(mockApiFetch).toHaveBeenCalledWith('/plugin-bridge/snapshot/mc-1');
  });

  it('renders probe status section', () => {
    render(<MinecraftDrillDownPage />);
    expect(screen.getAllByText('探针状态').length).toBeGreaterThan(0);
  });
});

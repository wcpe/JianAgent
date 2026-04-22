/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'srv-1' }),
  useNavigate: () => mockNavigate,
}));

// Mock stores
const mockFetchStatus = vi.fn().mockResolvedValue(undefined);
const mockSetStatus = vi.fn();
vi.mock('../../../stores/java-helper.store.js', () => ({
  useJavaHelperStore: () => ({
    status: { state: 'IDLE', attachedPid: null },
    loading: false,
    error: null,
    fetchStatus: mockFetchStatus,
    setStatus: mockSetStatus,
  }),
}));

// Mock APIs
vi.mock('../../../api/java-helper.api.js', () => ({
  javaHelperApi: {
    start: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../api/metrics.api.js', () => ({
  metricsApi: {
    getJmxLatest: vi.fn().mockResolvedValue(null),
  },
}));

// Mock ws channel
vi.mock('../../../ws/use-ws-channel.js', () => ({
  useWsChannel: vi.fn(),
}));

// Mock child panels to keep test focused on page structure
vi.mock('../ThreadDumpPanel.js', () => ({
  ThreadDumpPanel: () => <div data-testid="thread-dump-panel">ThreadDumpPanel</div>,
}));
vi.mock('../HeapAnalysisPanel.js', () => ({
  HeapAnalysisPanel: () => <div data-testid="heap-analysis-panel">HeapAnalysisPanel</div>,
}));
vi.mock('../JfrRecordingPanel.js', () => ({
  JfrRecordingPanel: () => <div data-testid="jfr-recording-panel">JfrRecordingPanel</div>,
}));
vi.mock('../SystemPropertiesPanel.js', () => ({
  SystemPropertiesPanel: () => <div data-testid="system-properties-panel">SystemPropertiesPanel</div>,
}));

import { JvmDiagnosticsPage } from '../JvmDiagnosticsPage.js';

describe('JvmDiagnosticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<JvmDiagnosticsPage />);
    expect(container).toBeTruthy();
  });

  it('displays the page title', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByText('JVM 深度钻取').length).toBeGreaterThan(0);
  });

  it('displays the server id', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByText('srv-1').length).toBeGreaterThan(0);
  });

  it('renders tab buttons', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByText('线程堆栈').length).toBeGreaterThan(0);
    expect(screen.getAllByText('堆分析').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JFR 录制').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统属性').length).toBeGreaterThan(0);
  });

  it('renders the default thread dump panel', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByTestId('thread-dump-panel').length).toBeGreaterThan(0);
  });

  it('renders helper status section', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByText('Helper 状态').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IDLE').length).toBeGreaterThan(0);
  });

  it('renders navigation buttons', () => {
    render(<JvmDiagnosticsPage />);
    expect(screen.getAllByText('← 返回').length).toBeGreaterThan(0);
    expect(screen.getAllByText('跳转到终端').length).toBeGreaterThan(0);
    expect(screen.getAllByText('跳转到日志').length).toBeGreaterThan(0);
  });

  it('calls fetchHelperStatus on mount', () => {
    render(<JvmDiagnosticsPage />);
    expect(mockFetchStatus).toHaveBeenCalled();
  });
});

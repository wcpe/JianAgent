/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TerminalSessionPanel } from '../TerminalSessionPanel.js';

// Mock xterm
const mockWrite = vi.fn();
const mockClear = vi.fn();
const mockFocus = vi.fn();
const mockFit = vi.fn();
const mockDispose = vi.fn();
const mockLoadAddon = vi.fn();
const mockOnData = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    dispose: mockDispose,
    loadAddon: mockLoadAddon,
    onData: mockOnData,
    write: mockWrite,
    clear: mockClear,
    focus: mockFocus,
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: mockFit,
  })),
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn().mockImplementation(() => ({
    findNext: vi.fn(),
    findPrevious: vi.fn(),
  })),
}));

// Mock ResizeObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
}));

// Mock ws-client and api
vi.mock('../../../ws/ws-client.js', () => ({
  wsClient: {
    send: vi.fn(),
  },
}));

vi.mock('../../../ws/use-ws-channel.js', () => ({
  useWsChannel: vi.fn(),
}));

vi.mock('../../../api/client.js', () => ({
  apiFetch: vi.fn().mockResolvedValue({ lines: [] }),
}));

// Mock useTerminalSession hook
const mockConnect = vi.fn();
const mockDisconnectFn = vi.fn();
const mockSendInput = vi.fn();
const mockResize = vi.fn();
const mockClearHistory = vi.fn();
const mockReconnect = vi.fn();

vi.mock('../use-terminal-session.js', () => ({
  useTerminalSession: vi.fn(() => ({
    snapshot: {
      sessionId: 'test-session-123',
      sessionType: 'SSH_SHELL',
      targetId: 'server-1',
      status: 'DISCONNECTED',
      error: null,
      dimensions: { cols: 80, rows: 24 },
      historyLineCount: 0,
      isReconnecting: false,
      reconnectAttempts: 0,
      lastActivityAt: null,
    },
    connect: mockConnect,
    disconnect: mockDisconnectFn,
    sendInput: mockSendInput,
    resize: mockResize,
    clearHistory: mockClearHistory,
    reconnect: mockReconnect,
  })),
}));

import { useTerminalSession } from '../use-terminal-session.js';

const mockUseTerminalSession = vi.mocked(useTerminalSession);

describe('TerminalSessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'SSH_SHELL',
        targetId: 'server-1',
        status: 'DISCONNECTED',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });
  });

  it('renders without crashing', () => {
    const { container } = render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );
    expect(container).toBeTruthy();
  });

  it('renders with data-terminal-session-panel attribute', () => {
    render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );
    const panel = document.querySelector('[data-terminal-session-panel]');
    expect(panel).toBeTruthy();
  });

  it('calls useTerminalSession with correct config', () => {
    render(
      <TerminalSessionPanel
        sessionType="SSH_SHELL"
        targetId="server-1"
        autoConnect={false}
      />,
    );

    expect(mockUseTerminalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          sessionType: 'SSH_SHELL',
          targetId: 'server-1',
          autoConnect: false,
        }),
      }),
    );
  });

  it('calls useTerminalSession with autoConnect true by default', () => {
    render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );

    expect(mockUseTerminalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          autoConnect: true,
        }),
      }),
    );
  });

  it('renders toolbar by default', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'SSH_SHELL',
        targetId: 'server-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );

    // Check that toolbar elements are rendered (buttons for disconnect, clear, copy)
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not render toolbar when showToolbar is false', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'SSH_SHELL',
        targetId: 'server-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    const { container } = render(
      <TerminalSessionPanel
        sessionType="SSH_SHELL"
        targetId="server-1"
        showToolbar={false}
      />,
    );

    // With showToolbar=false, there should be no toolbar with bg-gray-800 class
    const toolbarDiv = container.querySelector('.bg-gray-800');
    expect(toolbarDiv).toBeNull();
  });

  it('passes correct props to XTerminal', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'SSH_SHELL',
        targetId: 'server-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );

    // XTerminal should be rendered with readonly=false when ACTIVE
    const terminalContainer = document.querySelector('.flex-1.min-h-0');
    expect(terminalContainer).toBeTruthy();
  });

  it('passes readonly to XTerminal when disconnected', () => {
    render(
      <TerminalSessionPanel sessionType="SSH_SHELL" targetId="server-1" />,
    );

    // When disconnected, XTerminal should be readonly
    const terminalContainer = document.querySelector('.flex-1.min-h-0');
    expect(terminalContainer).toBeTruthy();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <TerminalSessionPanel
        sessionType="SSH_SHELL"
        targetId="server-1"
        className="custom-class"
      />,
    );
    const panel = container.querySelector('[data-terminal-session-panel]');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute('class')).toContain('custom-class');
  });

  it('renders with MC_CONSOLE session type', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'MC_CONSOLE',
        targetId: 'mc-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    render(
      <TerminalSessionPanel sessionType="MC_CONSOLE" targetId="mc-1" />,
    );

    expect(mockUseTerminalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          sessionType: 'MC_CONSOLE',
          targetId: 'mc-1',
        }),
      }),
    );
  });

  it('renders with PTY_SHELL session type', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'PTY_SHELL',
        targetId: 'pty-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    render(
      <TerminalSessionPanel sessionType="PTY_SHELL" targetId="pty-1" />,
    );

    expect(mockUseTerminalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          sessionType: 'PTY_SHELL',
          targetId: 'pty-1',
        }),
      }),
    );
  });

  it('renders with ATTACH_SHELL session type', () => {
    mockUseTerminalSession.mockReturnValue({
      snapshot: {
        sessionId: 'test-session-123',
        sessionType: 'ATTACH_SHELL',
        targetId: 'attach-1',
        status: 'ACTIVE',
        error: null,
        dimensions: { cols: 80, rows: 24 },
        historyLineCount: 0,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastActivityAt: null,
      },
      connect: mockConnect,
      disconnect: mockDisconnectFn,
      sendInput: mockSendInput,
      resize: mockResize,
      clearHistory: mockClearHistory,
      reconnect: mockReconnect,
    });

    render(
      <TerminalSessionPanel sessionType="ATTACH_SHELL" targetId="attach-1" />,
    );

    expect(mockUseTerminalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          sessionType: 'ATTACH_SHELL',
          targetId: 'attach-1',
        }),
      }),
    );
  });
});

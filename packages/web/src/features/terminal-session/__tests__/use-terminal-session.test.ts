/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalSession } from '../use-terminal-session.js';
import { useTerminalSessionStore } from '../terminal-session.store.js';

// Mock dependencies
vi.mock('../../../ws/ws-client.js', () => ({
  wsClient: {
    send: vi.fn(),
  },
}));

vi.mock('../../../ws/use-ws-channel.js', () => ({
  useWsChannel: vi.fn(),
}));

vi.mock('../../../api/client.js', () => ({
  apiFetch: vi.fn(),
}));

import { wsClient } from '../../../ws/ws-client.js';
import { apiFetch } from '../../../api/client.js';
import { useWsChannel } from '../../../ws/use-ws-channel.js';

const mockedWsClient = vi.mocked(wsClient);
const mockedApiFetch = vi.mocked(apiFetch);
const mockedUseWsChannel = vi.mocked(useWsChannel);

describe('useTerminalSession', () => {
  const defaultConfig = {
    sessionType: 'SSH_SHELL' as const,
    targetId: 'server-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset the store
    useTerminalSessionStore.setState({ sessions: {} });
    // Default mock for apiFetch
    mockedApiFetch.mockResolvedValue({ success: true, sessionId: 'session-123' } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with DISCONNECTED status when autoConnect is false', () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    expect(result.current.snapshot.status).toBe('DISCONNECTED');
    expect(result.current.snapshot.error).toBeNull();
  });

  it('provides all required methods', () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.sendInput).toBe('function');
    expect(typeof result.current.resize).toBe('function');
    expect(typeof result.current.clearHistory).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
  });

  it('connect() calls API and updates status', async () => {
    const onStatusChange = vi.fn();
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
        onStatusChange,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/servers/server-1/ssh/connect',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.snapshot.status).toBe('ACTIVE');
    expect(result.current.snapshot.sessionId).toBe('session-123');
    expect(onStatusChange).toHaveBeenCalledWith('ACTIVE');
    expect(mockedWsClient.send).toHaveBeenCalledWith({
      channel: 'terminal-session:subscribe',
      sessionId: 'session-123',
      payload: { sessionId: 'session-123' },
    });
  });

  it('connect() handles API error', async () => {
    const onError = vi.fn();
    const onStatusChange = vi.fn();
    mockedApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
        onError,
        onStatusChange,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(onError).toHaveBeenCalledWith('Network error');
    expect(onStatusChange).toHaveBeenCalledWith('ERROR');
  });

  it('connect() uses correct endpoint for MC_CONSOLE', async () => {
    const mcConfig = {
      sessionType: 'MC_CONSOLE' as const,
      targetId: 'mc-1',
      autoConnect: false,
    };

    const { result } = renderHook(() =>
      useTerminalSession({ config: mcConfig }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it('connect() uses correct endpoint for PTY_SHELL', async () => {
    const ptyConfig = {
      sessionType: 'PTY_SHELL' as const,
      targetId: 'pty-1',
      params: { shell: '/bin/zsh' },
      autoConnect: false,
    };

    const { result } = renderHook(() =>
      useTerminalSession({ config: ptyConfig }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/servers/pty-1/pty/shell',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ shell: '/bin/zsh' }),
      }),
    );
  });

  it('disconnect() calls API and unsubscribes from WS', async () => {
    const onStatusChange = vi.fn();

    // First connect
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
        onStatusChange,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    // Then disconnect
    vi.clearAllMocks();
    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/servers/server-1/ssh/disconnect?sessionId=session-123',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mockedWsClient.send).toHaveBeenCalledWith({
      channel: 'terminal-session:unsubscribe',
      sessionId: 'session-123',
      payload: { sessionId: 'session-123' },
    });
    expect(result.current.snapshot.status).toBe('DISCONNECTED');
    expect(onStatusChange).toHaveBeenCalledWith('DISCONNECTED');
  });

  it('sendInput() sends data via correct WS channel', async () => {
    // First connect
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    vi.clearAllMocks();

    // Send input
    act(() => {
      result.current.sendInput('ls -la\n');
    });

    expect(mockedWsClient.send).toHaveBeenCalledWith({
      channel: 'terminal-session:input',
      sessionId: 'session-123',
      payload: { sessionId: 'session-123', serverId: 'server-1', data: 'ls -la\n' },
    });
  });

  it('sendInput() does nothing when not connected', () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    act(() => {
      result.current.sendInput('ls -la\n');
    });

    expect(mockedWsClient.send).not.toHaveBeenCalled();
  });

  it('resize() sends dimensions via correct WS channel', async () => {
    // First connect
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    vi.clearAllMocks();

    // Resize
    act(() => {
      result.current.resize(120, 40);
    });

    expect(mockedWsClient.send).toHaveBeenCalledWith({
      channel: 'terminal-session:resize',
      sessionId: 'session-123',
      payload: { sessionId: 'session-123', cols: 120, rows: 40 },
    });

    // Check store was updated
    const storeSession = useTerminalSessionStore.getState().sessions['session-123'];
    expect(storeSession?.dimensions).toEqual({ cols: 120, rows: 40 });
  });

  it('resize() does nothing when not connected', () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    act(() => {
      result.current.resize(120, 40);
    });

    expect(mockedWsClient.send).not.toHaveBeenCalled();
  });

  it('clearHistory() resets history buffer', async () => {
    // First connect
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    // Simulate some history
    const store = useTerminalSessionStore.getState();
    store.incrementHistory('session-123', 10);

    expect(useTerminalSessionStore.getState().sessions['session-123']?.historyLineCount).toBe(10);

    // Clear history
    act(() => {
      result.current.clearHistory();
    });

    expect(useTerminalSessionStore.getState().sessions['session-123']?.historyLineCount).toBe(0);
  });

  it('reconnect() disconnects and connects again', async () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    // First connect
    await act(async () => {
      await result.current.connect();
    });

    vi.clearAllMocks();

    // Reconnect
    await act(async () => {
      result.current.reconnect();
    });

    // Should have called disconnect then connect
    expect(mockedApiFetch).toHaveBeenCalledTimes(2); // disconnect + connect
    expect(result.current.snapshot.status).toBe('ACTIVE');
  });

  it('auto-connects on mount when autoConnect is true', async () => {
    renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: true },
      }),
    );

    // Allow effects to run
    await vi.runAllTimersAsync();

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/servers/server-1/ssh/connect',
      expect.anything(),
    );
  });

  it('does not auto-connect on mount when autoConnect is false', async () => {
    renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    await vi.runAllTimersAsync();

    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it('registers useWsChannel for data channel', () => {
    renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    // Find the useWsChannel call for the data channel
    const dataChannelCall = mockedUseWsChannel.mock.calls.find(
      (call) => call[0] === 'terminal-session:data',
    );

    expect(dataChannelCall).toBeDefined();
    expect(dataChannelCall![0]).toBe('terminal-session:data');
  });

  it('registers useWsChannel for state channel', () => {
    renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
        autoReconnect: true,
      }),
    );

    // Find the useWsChannel call for state changes
    const stateChannelCall = mockedUseWsChannel.mock.calls.find(
      (call) => call[0] === 'resource:session:state',
    );

    expect(stateChannelCall).toBeDefined();
    expect(stateChannelCall![0]).toBe('resource:session:state');
  });

  it('snapshot returns correct default values', () => {
    const { result } = renderHook(() =>
      useTerminalSession({
        config: { ...defaultConfig, autoConnect: false },
      }),
    );

    const snapshot = result.current.snapshot;
    expect(snapshot.sessionType).toBe('SSH_SHELL');
    expect(snapshot.targetId).toBe('server-1');
    expect(snapshot.status).toBe('DISCONNECTED');
    expect(snapshot.error).toBeNull();
    expect(snapshot.dimensions).toEqual({ cols: 80, rows: 24 });
    expect(snapshot.historyLineCount).toBe(0);
    expect(snapshot.isReconnecting).toBe(false);
    expect(snapshot.reconnectAttempts).toBe(0);
    expect(snapshot.lastActivityAt).toBeNull();
  });
});

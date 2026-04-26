import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeGateway } from '../realtime.gateway.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
  } as any;
}

function createGateway() {
  const eventBus = { emit: vi.fn() } as any;
  const logFileService = {
    resolveLogsDir: vi.fn().mockResolvedValue('/tmp/logs'),
    startTail: vi.fn().mockReturnValue({ onLine: vi.fn(), close: vi.fn() }),
  } as any;
  const sessionService = {
    write: vi.fn(),
    resize: vi.fn(),
    get: vi.fn().mockReturnValue(null),
  } as any;
  const authService = {
    verifyToken: vi.fn().mockReturnValue({ sub: 'user-1', username: 'alice', role: 0 }),
  } as any;

  const gateway = new RealtimeGateway(eventBus, logFileService, sessionService, authService);
  return { gateway, eventBus, logFileService, sessionService, authService };
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

describe('RealtimeGateway lifecycle', () => {
  it('onModuleInit does not throw', () => {
    const { gateway } = createGateway();
    expect(() => gateway.onModuleInit()).not.toThrow();
  });

  it('onModuleDestroy clears the ping interval without throwing', () => {
    const { gateway } = createGateway();
    // pingInterval is only set after attachToServer; calling destroy before attach is safe
    expect(() => gateway.onModuleDestroy()).not.toThrow();
  });
});

// ── event handlers → broadcastToRoom ─────────────────────────────────────────

describe('RealtimeGateway event handlers', () => {
  let gateway: RealtimeGateway;
  let ws: ReturnType<typeof makeWs>;

  // Helper: put a connected WS client into a named room so broadcastToRoom has
  // somewhere to deliver messages.
  function addClientToRoom(room: string) {
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;
    let members = rooms.get(room);
    if (!members) {
      members = new Set();
      rooms.set(room, members);
    }
    members.add(ws);
  }

  beforeEach(() => {
    ({ gateway } = createGateway());
    ws = makeWs(1);
  });

  it('handleStateChanged broadcasts to server room and servers:status room', () => {
    addClientToRoom('server:srv-1');
    addClientToRoom('servers:status');

    gateway.handleStateChanged({
      serverId: 'srv-1',
      oldState: 'STOPPED',
      newState: 'RUNNING',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const calls = ws.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
    expect(calls[0].channel).toBe('resource:server:status');
    expect(calls[1].channel).toBe('resource:server:status');
  });

  it('handleServerCrashed broadcasts to server room and servers:status room', () => {
    addClientToRoom('server:srv-2');
    addClientToRoom('servers:status');

    gateway.handleServerCrashed({
      serverId: 'srv-2',
      exitCode: 1,
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:server:crashed');
  });

  it('handleServerHealth broadcasts to the per-server room only', () => {
    addClientToRoom('server:srv-3');

    gateway.handleServerHealth({
      serverId: 'srv-3',
      status: 'ok',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledOnce();
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:server:health');
  });

  it('handleControlPlaneAgentRegistered broadcasts to control-plane:agents room', () => {
    addClientToRoom('control-plane:agents');

    gateway.handleControlPlaneAgentRegistered({
      agentId: 'agent-1',
      hostId: 'host-1',
      capabilities: ['jmx'],
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledOnce();
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('task:control-plane:agent:registered');
  });

  it('handleControlPlaneAgentHeartbeat broadcasts to control-plane:agents room', () => {
    addClientToRoom('control-plane:agents');

    gateway.handleControlPlaneAgentHeartbeat({
      agentId: 'agent-1',
      hostId: 'host-1',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledOnce();
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('task:control-plane:agent:heartbeat');
  });

  it('handleFileTaskCreated broadcasts to server room and file-tasks room', () => {
    addClientToRoom('server:srv-4');
    addClientToRoom('file-tasks');

    gateway.handleFileTaskCreated({
      taskId: 'task-1',
      serverId: 'srv-4',
      kind: 'upload',
      sourcePaths: ['/a/b.jar'],
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('task:file-task:created');
  });

  it('handleFileTaskStateChanged broadcasts to server room and file-tasks room', () => {
    addClientToRoom('server:srv-5');
    addClientToRoom('file-tasks');

    gateway.handleFileTaskStateChanged({
      taskId: 'task-2',
      serverId: 'srv-5',
      kind: 'upload',
      oldState: 'PENDING',
      newState: 'DONE',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('task:file-task:state-changed');
  });

  it('handleLocalValidationRun broadcasts to run room and local-validation:runs room', () => {
    addClientToRoom('local-validation:run-abc');
    addClientToRoom('local-validation:runs');

    gateway.handleLocalValidationRun({
      runId: 'run-abc',
      status: 'RUNNING',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:local-validation:run');
  });

  it('handleLocalValidationStage broadcasts to run room and local-validation:runs room', () => {
    addClientToRoom('local-validation:run-abc');
    addClientToRoom('local-validation:runs');

    gateway.handleLocalValidationStage({
      runId: 'run-abc',
      stageId: 'stage-1',
      stageKey: 'smoke',
      title: 'Smoke',
      status: 'PASS',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:local-validation:stage');
  });

  it('handleLocalValidationAssertion broadcasts to run room and local-validation:runs room', () => {
    addClientToRoom('local-validation:run-abc');
    addClientToRoom('local-validation:runs');

    gateway.handleLocalValidationAssertion({
      runId: 'run-abc',
      stageId: 'stage-1',
      key: 'player-count',
      status: 'PASS',
      message: 'ok',
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:local-validation:assertion');
  });

  it('handleLocalValidationEvidence broadcasts to run room and local-validation:runs room', () => {
    addClientToRoom('local-validation:run-abc');
    addClientToRoom('local-validation:runs');

    gateway.handleLocalValidationEvidence({
      runId: 'run-abc',
      evidenceId: 'ev-1',
      kind: 'screenshot',
      summary: 'test',
      payload: {},
      timestamp: Date.now(),
    });

    expect(ws.send).toHaveBeenCalledTimes(2);
    const msg = JSON.parse(ws.send.mock.calls[0][0]);
    expect(msg.channel).toBe('resource:local-validation:evidence');
  });

  it('does not send to a client with readyState !== 1', () => {
    const closedWs = makeWs(3); // CLOSED
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;
    rooms.set('servers:status', new Set([closedWs]));

    gateway.handleStateChanged({
      serverId: 'srv-x',
      oldState: 'STOPPED',
      newState: 'RUNNING',
      timestamp: Date.now(),
    });

    expect(closedWs.send).not.toHaveBeenCalled();
  });
});

// ── room management (via private methods accessed through bracket notation) ───

describe('RealtimeGateway room management', () => {
  it('broadcastToRoom is a no-op when no clients are in the room', () => {
    const { gateway } = createGateway();
    expect(() =>
      gateway.handleStateChanged({
        serverId: 'nobody',
        oldState: 'STOPPED',
        newState: 'RUNNING',
        timestamp: Date.now(),
      }),
    ).not.toThrow();
  });

  it('removeFromAllRooms cleans up a disconnected client across multiple rooms', () => {
    const { gateway } = createGateway();
    const ws = makeWs(1);
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;

    rooms.set('room-a', new Set([ws]));
    rooms.set('room-b', new Set([ws]));

    (gateway as any).removeFromAllRooms(ws);

    expect(rooms.has('room-a')).toBe(false);
    expect(rooms.has('room-b')).toBe(false);
  });

  it('leaveRoom removes a client and deletes the room when it becomes empty', () => {
    const { gateway } = createGateway();
    const ws = makeWs(1);
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;
    rooms.set('test-room', new Set([ws]));

    (gateway as any).leaveRoom(ws, 'test-room');

    expect(rooms.has('test-room')).toBe(false);
  });

  it('joinRoom adds a client and creates the room if it does not exist', () => {
    const { gateway } = createGateway();
    const ws = makeWs(1);
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;

    (gateway as any).joinRoom(ws, 'new-room');

    expect(rooms.get('new-room')?.has(ws)).toBe(true);
  });

  it('joinRoom adds a second client to an existing room without removing the first', () => {
    const { gateway } = createGateway();
    const ws1 = makeWs(1);
    const ws2 = makeWs(1);
    const rooms: Map<string, Set<any>> = (gateway as any).rooms;

    (gateway as any).joinRoom(ws1, 'shared-room');
    (gateway as any).joinRoom(ws2, 'shared-room');

    expect(rooms.get('shared-room')?.size).toBe(2);
  });
});

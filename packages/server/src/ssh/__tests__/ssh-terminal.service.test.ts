import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { SshTerminalService } from '../ssh-terminal.service.js';

function createMockChannel() {
  const channel = new EventEmitter() as any;
  channel.stderr = new EventEmitter();
  channel.write = vi.fn();
  channel.setWindow = vi.fn();
  channel.close = vi.fn(() => channel.emit('close'));
  return channel;
}

function createMockTerminalSessionService() {
  return {
    create: vi.fn(() => {
      const session = new EventEmitter() as any;
      session.emitOutput = vi.fn();
      session.activate = vi.fn();
      return session;
    }),
    close: vi.fn(),
  };
}

describe('SshTerminalService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits sessions per server', async () => {
    const channel1 = createMockChannel();
    const channel2 = createMockChannel();
    const channel3 = createMockChannel();
    const channel4 = createMockChannel();
    const client = {
      shell: vi
        .fn()
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel1))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel2))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel3))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel4)),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(client),
      release: vi.fn(),
    };

    const service = new SshTerminalService(pool as any, createMockTerminalSessionService() as any);
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 's1');
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 's2');
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 's3');

    await expect(service.createSession({ id: 'srv-1', name: 'srv1' } as any, 's4'))
      .rejects
      .toThrow('SSH session quota exceeded');
  });

  it('closes idle sessions after timeout', async () => {
    const channel = createMockChannel();
    const client = {
      shell: vi.fn().mockImplementation((_opts: any, cb: Function) => cb(null, channel)),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(client),
      release: vi.fn(),
    };

    const service = new SshTerminalService(pool as any, createMockTerminalSessionService() as any);
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 's1');

    await vi.advanceTimersByTimeAsync(600_001);
    expect(service.getSession('s1')).toBeUndefined();
    expect(pool.release).toHaveBeenCalledTimes(1);
  });

  it('returns observability snapshot with quota and active session brief ids', async () => {
    const channel1 = createMockChannel();
    const channel2 = createMockChannel();
    const channel3 = createMockChannel();
    const client = {
      shell: vi
        .fn()
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel1))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel2))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel3)),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(client),
      release: vi.fn(),
    };

    const service = new SshTerminalService(pool as any, createMockTerminalSessionService() as any);
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 'ssh-srv-1-1111111111111');
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 'ssh-srv-1-2222222222222');
    await service.createSession({ id: 'srv-2', name: 'srv2' } as any, 'ssh-srv-2-3333333333333');

    const status = service.getObservabilitySnapshot('srv-1');
    expect(status.totalActiveSessions).toBe(3);
    expect(status.perServerQuota).toBe(3);
    expect(status.activeSessionsForServer).toBe(2);
    expect(status.remainingSessionsForServer).toBe(1);
    expect(status.activeSessionIds).toEqual(['ssh-srv-1-1111111111111', 'ssh-srv-1-2222222222222']);
    expect(status.activeSessionBriefIds).toEqual(['ssh-srv-1...1111', 'ssh-srv-1...2222']);
  });

  it('lists active sessions for server with idle information', async () => {
    const channel1 = createMockChannel();
    const channel2 = createMockChannel();
    const client = {
      shell: vi
        .fn()
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel1))
        .mockImplementationOnce((_opts: any, cb: Function) => cb(null, channel2)),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(client),
      release: vi.fn(),
    };

    const service = new SshTerminalService(pool as any, createMockTerminalSessionService() as any);
    await service.createSession({ id: 'srv-1', name: 'srv1' } as any, 'ssh-srv-1-1111111111111');
    await service.createSession({ id: 'srv-2', name: 'srv2' } as any, 'ssh-srv-2-2222222222222');

    await vi.advanceTimersByTimeAsync(1250);
    const sessions = service.listActiveSessions('srv-1');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe('ssh-srv-1-1111111111111');
    expect(sessions[0]?.sessionBriefId).toBe('ssh-srv-1...1111');
    expect(sessions[0]?.idleTimeoutMs).toBe(600_000);
    expect(sessions[0]?.idleForMs).toBeGreaterThanOrEqual(1200);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ServersController } from '../servers.controller.js';

describe('ServersController endpoints', () => {
  function buildController() {
    const sshPool = {
      isConnected: vi.fn().mockReturnValue(true),
    };
    const configService = {
      getById: vi.fn().mockResolvedValue({
        id: 'srv-1',
        name: 'srv-1',
      }),
      serverConfigToSshConfig: vi.fn(),
    };
    const scheduledStop = {
      schedule: vi.fn(),
      getScheduled: vi.fn(),
      cancel: vi.fn(),
    };
    const sshTerminal = {
      getObservabilitySnapshot: vi.fn().mockReturnValue({
        totalActiveSessions: 2,
        perServerQuota: 3,
        activeSessionsForServer: 1,
        remainingSessionsForServer: 2,
        activeSessionIds: ['ssh-srv-1-1111111111111'],
        activeSessionBriefIds: ['ssh-srv-1...1111'],
      }),
      listActiveSessions: vi.fn().mockReturnValue([
        {
          sessionId: 'ssh-srv-1-1111111111111',
          sessionBriefId: 'ssh-srv-1...1111',
          serverId: 'srv-1',
          openedAt: '2026-04-14T10:00:00.000Z',
          lastActivityAt: '2026-04-14T10:00:10.000Z',
          idleForMs: 5000,
          idleTimeoutMs: 600000,
        },
      ]),
    };

    const controller = new ServersController(
      {} as any,
      configService as any,
      {} as any,
      {} as any,
      scheduledStop as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      sshTerminal as any,
      sshPool as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return {
      controller,
      sshPool,
      sshTerminal,
      configService,
      scheduledStop,
    };
  }

  it('returns ssh status with observability snapshot', () => {
    const { controller, sshPool, sshTerminal } = buildController();

    const res = controller.sshStatus('srv-1');

    expect(sshPool.isConnected).toHaveBeenCalledWith('srv-1');
    expect(sshTerminal.getObservabilitySnapshot).toHaveBeenCalledWith('srv-1');
    expect(res.connected).toBe(true);
    expect(res.observability.activeSessionsForServer).toBe(1);
  });

  it('returns active ssh sessions for server', () => {
    const { controller, sshPool, sshTerminal } = buildController();

    const res = controller.sshSessions('srv-1');

    expect(sshPool.isConnected).toHaveBeenCalledWith('srv-1');
    expect(sshTerminal.listActiveSessions).toHaveBeenCalledWith('srv-1');
    expect(res.sessions).toHaveLength(1);
    expect(res.sessions[0]?.sessionBriefId).toBe('ssh-srv-1...1111');
  });

  it('should pass idempotency key to scheduled stop', async () => {
    const { controller, scheduledStop } = buildController();
    const now = new Date(Date.now() + 60_000).toISOString();

    await controller.scheduleStop('srv-1', { stopAt: now, mode: 'force' }, 'idem-stop');

    expect(scheduledStop.schedule).toHaveBeenCalledWith(
      'srv-1',
      expect.any(Date),
      'force',
      'manual',
      'idem-stop',
    );
  });

  it('should pass idempotency key to scheduled restart', async () => {
    const { controller, scheduledStop, configService } = buildController();
    const now = new Date(Date.now() + 60_000).toISOString();

    await controller.scheduleRestart('srv-1', { restartAt: now }, 'idem-restart');

    expect(configService.getById).toHaveBeenCalledWith('srv-1');
    expect(scheduledStop.schedule).toHaveBeenCalledWith(
      'srv-1',
      expect.any(Date),
      'graceful',
      'scheduled-restart',
      'idem-restart',
    );
  });
});

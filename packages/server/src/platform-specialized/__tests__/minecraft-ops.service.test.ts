import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MinecraftOpsService } from '../minecraft-ops.service.js';
import { PluginRuntimeState } from '@jian-agent/shared-domain';

function createService() {
  const multiServer = {
    getServer: vi.fn(),
    getManagedPingLatency: vi.fn(),
  };
  const metricStore = {
    getLatest: vi.fn(),
    queryWorldMetrics: vi.fn(),
  };
  const contextMapper = {
    toContext: vi.fn(),
  };

  const service = new MinecraftOpsService(
    multiServer as any,
    metricStore as any,
    contextMapper as any,
  );

  return { service, multiServer, metricStore, contextMapper };
}

describe('MinecraftOpsService', () => {
  let ctx: ReturnType<typeof createService>;

  beforeEach(() => {
    ctx = createService();
    vi.clearAllMocks();
  });

  it('throws NotFoundException when server is not found', async () => {
    ctx.multiServer.getServer.mockResolvedValue(null);

    await expect(ctx.service.buildSummary('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('builds a summary with players, plugins, and worlds from snapshot', async () => {
    ctx.multiServer.getServer.mockResolvedValue({
      id: 'host-1',
      name: 'TestMC',
      runtimeStatus: 'running',
      version: '1.20.4',
      maxPlayers: 30,
    });
    ctx.metricStore.getLatest.mockResolvedValue({
      timestamp: '2026-04-15T10:00:00Z',
      tps: 19.8,
      maxPlayers: 30,
      playerDetails: [
        { uuid: 'uuid-1', name: 'Steve', world: 'world', x: 100, y: 64, z: 200, health: 20, gameMode: 'survival' },
      ],
      pluginDetails: [
        { name: 'WorldEdit', version: '7.3.0', enabled: true },
        { name: 'Dynmap', version: '3.7', enabled: false },
      ],
    });
    ctx.metricStore.queryWorldMetrics.mockResolvedValue([
      { worldName: 'world', environment: 'normal', entityCount: 150, loadedChunks: 300 },
      { worldName: 'world_nether', environment: 'nether', entityCount: 80, loadedChunks: 120 },
    ]);
    ctx.multiServer.getManagedPingLatency.mockReturnValue(42);

    const summary = await ctx.service.buildSummary('mc-1');

    expect(summary.serverId).toBe('mc-1');
    expect(summary.serverRunning).toBe(true);
    expect(summary.tps).toBe(19.8);
    expect(summary.serverVersion).toBe('1.20.4');
    expect(summary.maxPlayers).toBe(30);

    // Players
    expect(summary.players).toHaveLength(1);
    expect(summary.players[0].name).toBe('Steve');
    expect(summary.players[0].gamemode).toBe('survival');

    // Plugins
    expect(summary.plugins).toHaveLength(2);
    expect(summary.plugins[0].state).toBe(PluginRuntimeState.RUNNING);
    expect(summary.plugins[1].state).toBe(PluginRuntimeState.STOPPED);

    // Worlds
    expect(summary.worlds).toHaveLength(2);
    expect(summary.worlds.find((w) => w.environment === 'nether')).toBeDefined();

    // Probe status
    expect(summary.probeStatus).not.toBeNull();
    expect(summary.probeStatus!.lastPingMs).toBe(42);
    expect(summary.probeStatus!.version).toBe('1.20.4');

    // Quick actions
    expect(summary.quickActions.length).toBeGreaterThan(0);
    expect(summary.quickActions.find((a) => a.id === 'broadcast')?.enabled).toBe(true);
  });

  it('builds summary with empty data when snapshot is unavailable', async () => {
    ctx.multiServer.getServer.mockResolvedValue({
      id: 'host-1',
      name: 'TestMC',
      runtimeStatus: 'stopped',
      version: null,
      maxPlayers: null,
    });
    ctx.metricStore.getLatest.mockResolvedValue(undefined);
    ctx.metricStore.queryWorldMetrics.mockResolvedValue([]);

    const summary = await ctx.service.buildSummary('mc-1');

    expect(summary.serverRunning).toBe(false);
    expect(summary.tps).toBeNull();
    expect(summary.players).toHaveLength(0);
    expect(summary.plugins).toHaveLength(0);
    expect(summary.worlds).toHaveLength(0);
    expect(summary.probeStatus).toBeNull();
    expect(summary.maxPlayers).toBe(20); // default
    expect(summary.serverVersion).toBeNull();

    // Quick actions should be disabled when server not running
    for (const action of summary.quickActions) {
      expect(action.enabled).toBe(false);
    }
  });

  it('normalises world environments correctly', async () => {
    ctx.multiServer.getServer.mockResolvedValue({
      id: 'host-1',
      name: 'TestMC',
      runtimeStatus: 'running',
      version: '1.20.4',
      maxPlayers: 20,
    });
    ctx.metricStore.getLatest.mockResolvedValue({
      timestamp: '2026-04-15T10:00:00Z',
      tps: 20,
      maxPlayers: 20,
      playerDetails: null,
      pluginDetails: null,
    });
    ctx.metricStore.queryWorldMetrics.mockResolvedValue([
      { worldName: 'world', environment: 'NORMAL', entityCount: 50, loadedChunks: 100 },
      { worldName: 'world_nether', environment: 'NETHER', entityCount: 30, loadedChunks: 60 },
      { worldName: 'world_the_end', environment: 'THE_END', entityCount: 10, loadedChunks: 40 },
    ]);
    ctx.multiServer.getManagedPingLatency.mockReturnValue(undefined);

    const summary = await ctx.service.buildSummary('mc-1');

    expect(summary.worlds).toHaveLength(3);
    expect(summary.worlds.find((w) => w.name === 'world')!.environment).toBe('normal');
    expect(summary.worlds.find((w) => w.name === 'world_nether')!.environment).toBe('nether');
    expect(summary.worlds.find((w) => w.name === 'world_the_end')!.environment).toBe('the_end');
  });

  it('includes save-off as confirmation-required quick action', async () => {
    ctx.multiServer.getServer.mockResolvedValue({
      id: 'host-1',
      name: 'TestMC',
      runtimeStatus: 'running',
      version: '1.20.4',
      maxPlayers: 20,
    });
    ctx.metricStore.getLatest.mockResolvedValue(undefined);
    ctx.metricStore.queryWorldMetrics.mockResolvedValue([]);
    ctx.multiServer.getManagedPingLatency.mockReturnValue(undefined);

    const summary = await ctx.service.buildSummary('mc-1');

    const saveOff = summary.quickActions.find((a) => a.id === 'save-off');
    expect(saveOff).toBeDefined();
    expect(saveOff!.requiresConfirmation).toBe(true);

    const saveAll = summary.quickActions.find((a) => a.id === 'save-all');
    expect(saveAll).toBeDefined();
    expect(saveAll!.requiresConfirmation).toBe(false);
  });

  it('handles metric store errors gracefully', async () => {
    ctx.multiServer.getServer.mockResolvedValue({
      id: 'host-1',
      name: 'TestMC',
      runtimeStatus: 'running',
      version: '1.20.4',
      maxPlayers: 20,
    });
    ctx.metricStore.getLatest.mockRejectedValue(new Error('db timeout'));
    ctx.metricStore.queryWorldMetrics.mockRejectedValue(new Error('db timeout'));
    ctx.multiServer.getManagedPingLatency.mockReturnValue(undefined);

    const summary = await ctx.service.buildSummary('mc-1');

    expect(summary.serverRunning).toBe(true);
    expect(summary.tps).toBeNull();
    expect(summary.players).toHaveLength(0);
    expect(summary.plugins).toHaveLength(0);
    expect(summary.worlds).toHaveLength(0);
  });
});

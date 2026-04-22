import { describe, it, expect, beforeEach } from 'vitest';
import { PluginBridgeController } from '../plugin-bridge.controller.js';
import { PluginBridgeService } from '../plugin-bridge.service.js';
import { SnapshotService } from '../snapshot.service.js';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';
import type { MetricStoreService } from '../../storage/metric-store.service.js';

const mockMetricStore: MetricStoreService = {
  insert: async () => {},
  queryRange: async () => [],
  getLatest: async () => undefined,
} as unknown as MetricStoreService;

describe('PluginBridgeController', () => {
  let controller: PluginBridgeController;
  let bridgeService: PluginBridgeService;
  let snapshotService: SnapshotService;

  beforeEach(() => {
    bridgeService = new PluginBridgeService();
    snapshotService = new SnapshotService(mockMetricStore);
    controller = new PluginBridgeController(bridgeService, snapshotService);
  });

  it('should list connections (empty)', () => {
    const result = controller.listConnections();
    expect(result).toEqual([]);
  });

  it('should include runtime metadata in connection listing', () => {
    const ws = { readyState: 1, send: () => {}, close: () => {} } as any;
    bridgeService.addConnection('srv-1', ws, 2, {
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'world-events'],
    });

    const result = controller.listConnections();

    expect(result[0]?.runtimeKind).toBe('paper-1.21+');
    expect(result[0]?.capabilityMatrix).toContain('world-events');
  });

  it('should return all snapshots', () => {
    const snapshot: ProbeSnapshotDto = {
      tps: 20.0, mspt: 12.5, onlinePlayers: 5, maxPlayers: 100,
      loadedChunks: 100, entityCount: 200, worldCount: 1,
      freeMemoryMb: 1024, totalMemoryMb: 2048, uptime: '00:10:00',
      timestamp: '2026-01-01T00:00:00Z',
    };
    snapshotService.onSnapshot('srv-1', snapshot);
    const result = controller.getAllSnapshots();
    expect(result).toHaveLength(1);
    expect(result[0].serverId).toBe('srv-1');
  });

  it('should throw on missing snapshot', () => {
    expect(() => controller.getSnapshot('unknown')).toThrow();
  });

  it('should reject command with no action', () => {
    expect(() => controller.sendCommand('srv-1', { action: '', params: {} })).toThrow();
  });

  it('should reject console command with no command', () => {
    expect(() => controller.executeConsole('srv-1', { command: '' })).toThrow('Missing command');
  });

  it('should throw when plugin not connected for console command', () => {
    expect(() => controller.executeConsole('srv-1', { command: 'list' })).toThrow('Plugin not connected');
  });

  it('should send console command when plugin is connected', () => {
    const ws = { readyState: 1, send: () => {}, close: () => {} } as any;
    bridgeService.addConnection('srv-1', ws, 1);
    const result = controller.executeConsole('srv-1', { command: 'list' });
    expect(result.sent).toBe(true);
    expect(result.requestId).toMatch(/^console-/);
  });

  it('should reject eval script with no script', () => {
    expect(() => controller.evalScript('srv-1', { script: '' })).toThrow('Missing script');
  });

  it('should throw when plugin not connected for eval script', () => {
    expect(() => controller.evalScript('srv-1', { script: 'test' })).toThrow('Plugin not connected');
  });

  it('should send eval script when plugin is connected', () => {
    const ws = { readyState: 1, send: () => {}, close: () => {} } as any;
    bridgeService.addConnection('srv-1', ws, 1);
    const result = controller.evalScript('srv-1', { script: 'server.getTPS()' });
    expect(result.sent).toBe(true);
    expect(result.requestId).toMatch(/^eval-/);
  });
});

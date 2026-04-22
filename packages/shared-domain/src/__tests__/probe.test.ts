import { describe, it, expect } from 'vitest';
import { ProbeStatus } from '../enums/probe-status.js';
import type { ProbeSnapshotDto, ProbeEventDto, ProbeCommandDto, ProbeSummaryDto } from '../dto/probe.dto.js';

describe('ProbeStatus', () => {
  it('should define all states', () => {
    expect(ProbeStatus.UNAVAILABLE).toBe('UNAVAILABLE');
    expect(ProbeStatus.CONNECTING).toBe('CONNECTING');
    expect(ProbeStatus.HANDSHAKING).toBe('HANDSHAKING');
    expect(ProbeStatus.READY).toBe('READY');
    expect(ProbeStatus.DISCONNECTED).toBe('DISCONNECTED');
    expect(ProbeStatus.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
  });

  it('should have exactly 6 states', () => {
    expect(Object.keys(ProbeStatus)).toHaveLength(6);
  });
});

describe('ProbeSnapshotDto structural check', () => {
  it('should accept valid shape', () => {
    const dto: ProbeSnapshotDto = {
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'plugins'],
      tps: 20.0,
      mspt: 12.5,
      onlinePlayers: 10,
      maxPlayers: 100,
      loadedChunks: 256,
      entityCount: 500,
      worldCount: 3,
      freeMemoryMb: 2048,
      totalMemoryMb: 4096,
      uptime: '01:30:00',
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(dto.tps).toBe(20.0);
    expect(dto.runtimeKind).toBe('paper-1.21+');
    expect(dto.timestamp).toBeDefined();
  });
});

describe('ProbeEventDto structural check', () => {
  it('should accept valid shape', () => {
    const dto: ProbeEventDto = {
      serverId: 'srv-1',
      eventType: 'PLAYER_JOIN',
      data: { playerName: 'Steve' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(dto.eventType).toBe('PLAYER_JOIN');
  });
});

describe('ProbeCommandDto structural check', () => {
  it('should accept valid shape', () => {
    const dto: ProbeCommandDto = {
      requestId: 'r1',
      action: 'TELEPORT',
      params: { target: 'Steve', x: 10, y: 64, z: 10 },
    };
    expect(dto.action).toBe('TELEPORT');
  });
});

describe('ProbeSummaryDto structural check', () => {
  it('should expose runtime metadata and capability matrix', () => {
    const dto: ProbeSummaryDto = {
      serverId: 'srv-1',
      status: 'READY',
      pluginVersion: '1.0.0',
      protocolVersion: 2,
      connectedAt: '2026-01-01T00:00:00Z',
      lastSnapshotAt: '2026-01-01T00:01:00Z',
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'plugins', 'world-events'],
    };
    expect(dto.protocolVersion).toBe(2);
    expect(dto.runtimeKind).toBe('paper-1.21+');
    expect(dto.capabilityMatrix).toContain('world-events');
  });
});

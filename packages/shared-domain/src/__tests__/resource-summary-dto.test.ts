import { describe, it, expect } from 'vitest';
import { ResourceKind, serverToResourceSummary, remoteHostToResourceSummary } from '../index.js';
import type { ResourceSummaryDto, ServerWithStatusDto, RemoteHostDto } from '../index.js';

describe('ResourceSummaryDto', () => {
  it('should be assignable from a minimal object', () => {
    const summary: ResourceSummaryDto = {
      id: 'res-1',
      kind: ResourceKind.SERVER,
      name: 'Test Server',
      status: 'running',
      statusDetail: null,
      hostType: 'local',
      host: 'localhost',
      port: 25565,
      tags: ['production'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
    };

    expect(summary.id).toBe('res-1');
    expect(summary.kind).toBe('SERVER');
    expect(summary.name).toBe('Test Server');
    expect(summary.status).toBe('running');
    expect(summary.statusDetail).toBeNull();
    expect(summary.hostType).toBe('local');
    expect(summary.host).toBe('localhost');
    expect(summary.port).toBe(25565);
    expect(summary.tags).toEqual(['production']);
    expect(summary.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(summary.updatedAt).toBe('2026-04-15T00:00:00Z');
  });

  it('should allow null host and port', () => {
    const summary: ResourceSummaryDto = {
      id: 'res-2',
      kind: ResourceKind.BOT,
      name: 'bot_1',
      status: 'idle',
      statusDetail: 'waiting',
      hostType: 'local',
      host: null,
      port: null,
      tags: [],
      createdAt: '',
      updatedAt: '',
    };

    expect(summary.host).toBeNull();
    expect(summary.port).toBeNull();
  });

  it('should allow remote hostType', () => {
    const summary: ResourceSummaryDto = {
      id: 'res-3',
      kind: ResourceKind.REMOTE_HOST,
      name: 'Remote',
      status: 'connected',
      statusDetail: null,
      hostType: 'remote',
      host: '192.168.1.100',
      port: 22,
      tags: ['dev'],
      createdAt: '',
      updatedAt: '',
    };

    expect(summary.hostType).toBe('remote');
  });
});

describe('serverToResourceSummary', () => {
  it('should convert ServerWithStatusDto to ResourceSummaryDto', () => {
    const server: ServerWithStatusDto = {
      id: 'sv-1',
      name: 'Main Server',
      serverType: 'managed',
      host: 'localhost',
      port: 25565,
      jarPath: '/opt/server.jar',
      workDir: '/opt',
      runtimeStatus: 'running',
      restartCount: 0,
    };

    const summary = serverToResourceSummary(server);

    expect(summary.id).toBe('sv-1');
    expect(summary.kind).toBe('SERVER');
    expect(summary.name).toBe('Main Server');
    expect(summary.status).toBe('running');
    expect(summary.statusDetail).toBeNull();
    expect(summary.hostType).toBe('local');
    expect(summary.host).toBe('localhost');
    expect(summary.port).toBe(25565);
    expect(summary.tags).toEqual([]);
    expect(summary.createdAt).toBe('');
    expect(summary.updatedAt).toBe('');
  });

  it('should map error status correctly', () => {
    const server: ServerWithStatusDto = {
      id: 'sv-2',
      name: 'Broken',
      serverType: 'external',
      host: '10.0.0.1',
      port: 25565,
      jarPath: '',
      workDir: '',
      runtimeStatus: 'error',
      restartCount: 3,
    };

    const summary = serverToResourceSummary(server);
    expect(summary.status).toBe('error');
  });
});

describe('remoteHostToResourceSummary', () => {
  it('should convert RemoteHostDto to ResourceSummaryDto', () => {
    const host: RemoteHostDto = {
      id: 'rh-1',
      name: 'Worker Node',
      host: '192.168.1.50',
      port: 22,
      username: 'admin',
      authType: 'key',
      tags: ['prod', 'cluster'],
      description: 'Worker node',
      status: 'connected',
      lastConnectedAt: '2026-04-15T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-04-15T12:00:00Z',
    };

    const summary = remoteHostToResourceSummary(host);

    expect(summary.id).toBe('rh-1');
    expect(summary.kind).toBe('REMOTE_HOST');
    expect(summary.name).toBe('Worker Node');
    expect(summary.status).toBe('connected');
    expect(summary.statusDetail).toBeNull();
    expect(summary.hostType).toBe('remote');
    expect(summary.host).toBe('192.168.1.50');
    expect(summary.port).toBe(22);
    expect(summary.tags).toEqual(['prod', 'cluster']);
    expect(summary.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(summary.updatedAt).toBe('2026-04-15T12:00:00Z');
  });
});

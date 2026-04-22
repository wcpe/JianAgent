import { describe, it, expect } from 'vitest';
import { ResourceMapper } from '../resource.mapper.js';
import { ResourceKind } from '@jian-agent/shared-domain';
import type { ResourceSummaryDto } from '@jian-agent/shared-domain';

describe('ResourceMapper', () => {
  const mapper = new ResourceMapper();

  describe('fromServer', () => {
    it('should map a managed server to ResourceSummaryDto', () => {
      const summary = mapper.fromServer({
        id: 'sv-1',
        name: 'Main Server',
        serverType: 'managed',
        host: 'localhost',
        port: 25565,
        jarPath: '/opt/server.jar',
        workDir: '/opt',
        runtimeStatus: 'running',
        restartCount: 0,
      });

      expect(summary.id).toBe('sv-1');
      expect(summary.kind).toBe(ResourceKind.SERVER);
      expect(summary.name).toBe('Main Server');
      expect(summary.status).toBe('running');
      expect(summary.hostType).toBe('local');
      expect(summary.host).toBe('localhost');
      expect(summary.port).toBe(25565);
    });

    it('should map error status correctly', () => {
      const summary = mapper.fromServer({
        id: 'sv-2',
        name: 'Broken',
        serverType: 'external',
        host: '10.0.0.1',
        port: 25565,
        jarPath: '',
        workDir: '',
        runtimeStatus: 'error',
        restartCount: 3,
      });

      expect(summary.status).toBe('error');
    });
  });

  describe('fromRemoteHost', () => {
    it('should map a remote host to ResourceSummaryDto', () => {
      const summary = mapper.fromRemoteHost({
        id: 'rh-1',
        name: 'Worker Node',
        host: '192.168.1.50',
        port: 22,
        username: 'admin',
        authType: 'key',
        tags: ['prod', 'cluster'],
        description: 'Worker',
        status: 'connected',
        lastConnectedAt: '2026-04-15T10:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-04-15T12:00:00Z',
      });

      expect(summary.id).toBe('rh-1');
      expect(summary.kind).toBe(ResourceKind.REMOTE_HOST);
      expect(summary.hostType).toBe('remote');
      expect(summary.host).toBe('192.168.1.50');
      expect(summary.port).toBe(22);
      expect(summary.tags).toEqual(['prod', 'cluster']);
    });
  });

  describe('fromExternalJvm', () => {
    it('should map an external JVM to ResourceSummaryDto', () => {
      const summary = mapper.fromExternalJvm({
        id: 'jvm-1',
        name: 'Forge Server',
        runtimeType: 'jar',
        status: 'online',
        host: '10.0.0.5',
        port: 25566,
      });

      expect(summary.id).toBe('jvm-1');
      expect(summary.kind).toBe(ResourceKind.RUNTIME);
      expect(summary.name).toBe('Forge Server');
      expect(summary.status).toBe('online');
      expect(summary.statusDetail).toBe('runtime=jar');
      expect(summary.hostType).toBe('remote');
      expect(summary.host).toBe('10.0.0.5');
      expect(summary.port).toBe(25566);
      expect(summary.tags).toEqual([]);
    });

    it('should default status and host when omitted', () => {
      const summary = mapper.fromExternalJvm({
        id: 'jvm-2',
        name: 'Minimal',
        runtimeType: 'container',
      });

      expect(summary.status).toBe('unknown');
      expect(summary.statusDetail).toBe('runtime=container');
      expect(summary.host).toBeNull();
      expect(summary.port).toBeNull();
    });
  });

  describe('fromGeneric', () => {
    it('should map a generic source with defaults', () => {
      const summary: ResourceSummaryDto = mapper.fromGeneric({
        id: 'gen-1',
        name: 'Custom',
        kind: ResourceKind.BOT,
        status: 'idle',
      });

      expect(summary.id).toBe('gen-1');
      expect(summary.kind).toBe(ResourceKind.BOT);
      expect(summary.statusDetail).toBeNull();
      expect(summary.hostType).toBe('local');
      expect(summary.host).toBeNull();
      expect(summary.port).toBeNull();
      expect(summary.tags).toEqual([]);
    });

    it('should preserve all provided fields', () => {
      const summary = mapper.fromGeneric({
        id: 'gen-2',
        name: 'Full',
        kind: ResourceKind.SESSION,
        status: 'active',
        statusDetail: 'phase=running',
        hostType: 'remote',
        host: '10.0.0.1',
        port: 8080,
        tags: ['test'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-04-15T00:00:00Z',
      });

      expect(summary.statusDetail).toBe('phase=running');
      expect(summary.hostType).toBe('remote');
      expect(summary.host).toBe('10.0.0.1');
      expect(summary.port).toBe(8080);
      expect(summary.tags).toEqual(['test']);
      expect(summary.createdAt).toBe('2026-01-01T00:00:00Z');
      expect(summary.updatedAt).toBe('2026-04-15T00:00:00Z');
    });
  });
});

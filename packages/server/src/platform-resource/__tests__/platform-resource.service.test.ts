import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalValidationRunDto,
  RemoteHostDto,
  ServerWithStatusDto,
} from '@jian-agent/shared-domain';
import { PlatformResourceService } from '../platform-resource.service.js';
import { ResourceCapabilityResolver } from '../resource-capability.resolver.js';
import { ResourceDetailMapper } from '../resource-detail.mapper.js';

function createServer(id: string, serverType: 'managed' | 'external'): ServerWithStatusDto {
  return {
    id,
    name: serverType === 'managed' ? 'Managed Alpha' : 'External Beta',
    serverType,
    host: serverType === 'managed' ? '127.0.0.1' : 'mc.example.com',
    port: serverType === 'managed' ? 25565 : 25575,
    jarPath: '/srv/server.jar',
    workDir: '/srv',
    runtimeStatus: serverType === 'managed' ? 'running' : 'unknown',
    restartCount: 0,
    serverGroup: serverType === 'managed' ? 'core' : 'edge',
    tags: serverType === 'managed' ? ['prod', 'paper'] : ['external'],
    description: `${serverType} resource`,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  };
}

function createRemoteHost(): RemoteHostDto {
  return {
    id: 'host-1',
    name: 'SSH Bastion',
    host: '192.168.0.10',
    port: 22,
    username: 'root',
    authType: 'key',
    tags: ['ops'],
    description: 'Operations bastion',
    status: 'online',
    lastConnectedAt: '2026-04-20T00:00:00.000Z',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    hasPassword: false,
    hasPassphrase: true,
  };
}

function createRun(serverId: string): LocalValidationRunDto {
  return {
    id: 'lvr_001',
    name: 'Managed Alpha validation',
    mode: 'init-paper',
    serverId,
    status: 'PASSED',
    scenarioPackId: 'combat-pack-v1',
    requestedBotCount: 8,
    effectiveBotCount: 8,
    requestedBy: 'qa',
    keepServerRunning: false,
    keepWorkspace: true,
    workspacePath: '/tmp/lvr_001',
    finishedAt: '2026-04-20T00:10:00.000Z',
  };
}

describe('PlatformResourceService', () => {
  let service: PlatformResourceService;
  let multiServer: {
    listServers: ReturnType<typeof vi.fn>;
    getServer: ReturnType<typeof vi.fn>;
    getManagedPingLatency: ReturnType<typeof vi.fn>;
    isExternalOnline: ReturnType<typeof vi.fn>;
  };
  let remoteHost: {
    list: ReturnType<typeof vi.fn>;
    getByIdDto: ReturnType<typeof vi.fn>;
  };
  let localValidationStore: {
    getLatestRunsByServerIds: ReturnType<typeof vi.fn>;
  };
  let platformRuntime: {
    getCapabilities: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    multiServer = {
      listServers: vi.fn(),
      getServer: vi.fn(),
      getManagedPingLatency: vi.fn().mockReturnValue(15),
      isExternalOnline: vi.fn().mockReturnValue(false),
    };
    remoteHost = {
      list: vi.fn(),
      getByIdDto: vi.fn(),
    };
    localValidationStore = {
      getLatestRunsByServerIds: vi.fn(),
    };
    platformRuntime = {
      getCapabilities: vi.fn().mockReturnValue({
        storageDialect: 'sqlite',
        logBackendMode: 'hybrid',
        probeRuntimeKind: 'paper-1.21+',
        realtimeCapacityMode: 'standard',
      }),
    };

    service = new PlatformResourceService(
      multiServer as any,
      remoteHost as any,
      localValidationStore as any,
      new ResourceDetailMapper(),
      new ResourceCapabilityResolver(),
      platformRuntime as any,
    );
  });

  it('lists unified workspace items with validation summary and actions', async () => {
    const managed = createServer('srv-managed', 'managed');
    const external = createServer('srv-external', 'external');
    const host = createRemoteHost();
    multiServer.listServers.mockResolvedValue([managed, external]);
    remoteHost.list.mockResolvedValue([host]);
    localValidationStore.getLatestRunsByServerIds.mockResolvedValue(
      new Map([[managed.id, createRun(managed.id)]]),
    );

    const result = await service.listWorkspace({ kind: 'SERVER' });

    expect(result.items).toHaveLength(2);
    expect(result.summary.byKind.SERVER).toBe(2);
    expect(result.items[0]?.availableActions.some((action) => action.key === 'start')).toBe(true);
    expect(result.items[0]?.latestValidationSummary?.verdict).toBe('passed');
    expect(result.items[0]?.status.storageHealth).toBe('healthy');
    expect(result.items[0]?.status.logBackendState).toBe('degraded');
    expect(result.items[0]?.status.probeRuntimeKind).toBe('paper-1.21+');
    expect(result.items[0]?.status.compatibilityTags).toContain('storage:sqlite');
    expect(result.items[1]?.serverType).toBe('external');
    expect(result.items[1]?.availableActions.map((action) => action.key)).toContain('ping');
  });

  it('returns detailed remote-host view with truthful capabilities', async () => {
    const host = createRemoteHost();
    multiServer.getServer.mockResolvedValue(null);
    multiServer.listServers.mockResolvedValue([]);
    remoteHost.getByIdDto.mockResolvedValue(host);
    localValidationStore.getLatestRunsByServerIds.mockResolvedValue(new Map());

    const detail = await service.getDetailById(host.id);

    expect(detail.kind).toBe('REMOTE_HOST');
    expect(detail.capabilities.terminal.enabled).toBe(true);
    expect(detail.capabilities.files.enabled).toBe(false);
    expect(detail.availableActions.map((action) => action.key)).toContain('test-connection');
    expect(detail.latestValidationSummary).toBeNull();
    expect(detail.status.compatibilityTags).toContain('ssh');
    expect(detail.status.probeRuntimeKind).toBeNull();
  });
});

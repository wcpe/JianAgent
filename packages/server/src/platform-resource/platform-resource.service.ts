import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ResourceKind,
  remoteHostToResourceSummary,
  serverToResourceSummary,
} from '@jian-agent/shared-domain';
import type {
  LocalValidationRunDto,
  LogBackendState,
  RemoteHostDto,
  ResourceActionDto,
  ResourceDetailDto,
  ResourceValidationSummaryDto,
  ResourceWorkspaceItemDto,
  ResourceWorkspaceListDto,
  ResourceWorkspaceSummaryDto,
  ServerType,
  ServerWithStatusDto,
} from '@jian-agent/shared-domain';
import { MultiServerService } from '../server-process/multi-server.service.js';
import { RemoteHostService } from '../remote-host/remote-host.service.js';
import { LocalValidationStore } from '../local-validation/local-validation.store.js';
import { ResourceDetailMapper } from './resource-detail.mapper.js';
import { ResourceCapabilityResolver } from './resource-capability.resolver.js';
import { PlatformRuntimeService } from '../platform-runtime/platform-runtime.service.js';

interface ResourceWorkspaceQuery {
  readonly kind?: string;
  readonly serverType?: ServerType;
  readonly status?: string;
  readonly q?: string;
  readonly group?: string;
  readonly tag?: string;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Platform-resource aggregation service.
 *
 * Provides a unified entry point to load any platform resource by its
 * (kind, id) pair and returns a canonical ResourceDetailDto.  The service
 * delegates to the appropriate domain service (MultiServerService,
 * RemoteHostService, …) and uses the mapper + capability resolver to
 * normalise the output.
 */
@Injectable()
export class PlatformResourceService {
  private readonly logger = new Logger(PlatformResourceService.name);

  constructor(
    private readonly multiServer: MultiServerService,
    private readonly remoteHost: RemoteHostService,
    private readonly localValidationStore: LocalValidationStore,
    private readonly detailMapper: ResourceDetailMapper,
    private readonly capabilityResolver: ResourceCapabilityResolver,
    private readonly platformRuntime: PlatformRuntimeService,
  ) {}

  // ── single-resource lookup ───────────────────────────────────

  /**
   * Load a single resource by kind and id.
   * Throws NotFoundException when the resource does not exist.
   */
  async getDetail(kind: string, id: string): Promise<ResourceDetailDto> {
    switch (kind) {
      case ResourceKind.SERVER:
        return this.getServerDetail(id);
      case ResourceKind.REMOTE_HOST:
        return this.getRemoteHostDetail(id);
      default:
        throw new NotFoundException(
          `Unknown resource kind "${kind}" for id "${id}"`,
        );
    }
  }

  /**
   * Resolve capabilities only (without the full detail payload).
   * Useful for lightweight capability checks from other modules.
   */
  async getCapabilities(
    kind: string,
    id: string,
  ): Promise<ReturnType<ResourceCapabilityResolver['resolve']>> {
    switch (kind) {
      case ResourceKind.SERVER: {
        const server = await this.multiServer.getServer(id);
        if (!server) {
          throw new NotFoundException(`Server ${id} not found`);
        }
        return this.capabilityResolver.resolveForServer(server);
      }
      case ResourceKind.REMOTE_HOST: {
        const host = await this.remoteHost.getByIdDto(id);
        return this.capabilityResolver.resolveForRemoteHost(host);
      }
      default:
        throw new NotFoundException(
          `Unknown resource kind "${kind}" for id "${id}"`,
        );
    }
  }

  // ── list helpers ─────────────────────────────────────────────

  /** List all servers as ResourceDetailDto[]. */
  async listServerDetails(): Promise<ResourceDetailDto[]> {
    const [servers, validationMap] = await Promise.all([
      this.multiServer.listServers(),
      this.getValidationSummaryMap(),
    ]);
    return servers.map((server) =>
      this.buildServerDetail(server, validationMap.get(server.id) ?? null),
    );
  }

  /** List all remote hosts as ResourceDetailDto[]. */
  async listRemoteHostDetails(): Promise<ResourceDetailDto[]> {
    const hosts = await this.remoteHost.list();
    return hosts.map((host) => this.buildRemoteHostDetail(host));
  }

  /** List all resources across all kinds. */
  async listAll(): Promise<ResourceDetailDto[]> {
    const [servers, hosts, validationMap] = await Promise.all([
      this.multiServer.listServers(),
      this.remoteHost.list(),
      this.getValidationSummaryMap(),
    ]);
    return [
      ...servers.map((server) =>
        this.buildServerDetail(server, validationMap.get(server.id) ?? null),
      ),
      ...hosts.map((host) => this.buildRemoteHostDetail(host)),
    ];
  }

  async listWorkspace(
    query: ResourceWorkspaceQuery = {},
  ): Promise<ResourceWorkspaceListDto> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 24, 1), 200);

    const [servers, hosts, validationMap] = await Promise.all([
      this.multiServer.listServers(),
      this.remoteHost.list(),
      this.getValidationSummaryMap(),
    ]);

    const items: ResourceWorkspaceItemDto[] = [
      ...servers.map((server) =>
        this.buildWorkspaceItemFromServer(
          server,
          validationMap.get(server.id) ?? null,
        ),
      ),
      ...hosts.map((host) => this.buildWorkspaceItemFromRemoteHost(host)),
    ];

    const filtered = items.filter((item) => this.matchesWorkspaceQuery(item, query));
    const summary = this.buildWorkspaceSummary(filtered);
    const start = (page - 1) * limit;

    return {
      items: filtered.slice(start, start + limit),
      summary,
      page,
      limit,
      total: filtered.length,
    };
  }

  // ── id-only lookup (auto-resolve kind) ───────────────────────

  /**
   * Resolve detail by id alone — tries SERVER first, then REMOTE_HOST.
   * Throws NotFoundException when no resource matches.
   */
  async getDetailById(id: string): Promise<ResourceDetailDto> {
    const [server, validationMap] = await Promise.all([
      this.multiServer.getServer(id),
      this.getValidationSummaryMap(),
    ]);
    if (server) {
      return this.buildServerDetail(server, validationMap.get(id) ?? null);
    }
    try {
      const host = await this.remoteHost.getByIdDto(id);
      return this.buildRemoteHostDetail(host);
    } catch {
      throw new NotFoundException(`Resource ${id} not found`);
    }
  }

  /**
   * Resolve capabilities by id alone — tries SERVER first, then REMOTE_HOST.
   */
  async getCapabilitiesById(
    id: string,
  ): Promise<ReturnType<ResourceCapabilityResolver['resolve']>> {
    const server = await this.multiServer.getServer(id);
    if (server) {
      return this.capabilityResolver.resolveForServer(server);
    }
    try {
      const host = await this.remoteHost.getByIdDto(id);
      return this.capabilityResolver.resolveForRemoteHost(host);
    } catch {
      throw new NotFoundException(`Resource ${id} not found`);
    }
  }

  // ── private ──────────────────────────────────────────────────

  private async getServerDetail(id: string): Promise<ResourceDetailDto> {
    const server = await this.multiServer.getServer(id);
    if (!server) {
      throw new NotFoundException(`Server ${id} not found`);
    }
    const validationMap = await this.getValidationSummaryMap([id]);
    return this.buildServerDetail(server, validationMap.get(id) ?? null);
  }

  private async getRemoteHostDetail(id: string): Promise<ResourceDetailDto> {
    const host = await this.remoteHost.getByIdDto(id);
    return this.buildRemoteHostDetail(host);
  }

  private buildServerDetail(
    server: ServerWithStatusDto,
    latestValidationSummary: ResourceValidationSummaryDto | null,
  ): ResourceDetailDto {
    const capabilities = this.capabilityResolver.resolveForServer(server, {
      helperAttached: false,
      jfrSupported: false,
      probeActive:
        server.serverType === 'managed'
          ? this.multiServer.getManagedPingLatency(server.id) != null
          : this.multiServer.isExternalOnline(server.id),
      jmxEnabled: false,
      pluginCount: 0,
      logCollectionCount: 0,
      alertRuleCount: 0,
    });
    const base = this.detailMapper.fromServer(server, capabilities);
    const runtime = this.platformRuntime.getCapabilities();
    return {
      ...base,
      status: {
        ...base.status,
        storageHealth: 'healthy',
        logBackendState: this.resolveLogBackendState(runtime.logBackendMode),
        degradedMode:
          this.resolveLogBackendState(runtime.logBackendMode) !== 'healthy',
        probeRuntimeKind:
          server.serverType === 'managed' ? runtime.probeRuntimeKind : null,
        compatibilityTags: this.buildServerCompatibilityTags(server, runtime),
      },
      availableActions: this.buildServerActions(
        server,
        capabilities.terminal.enabled,
        capabilities.files.enabled,
      ),
      latestValidationSummary,
    };
  }

  private buildRemoteHostDetail(host: RemoteHostDto): ResourceDetailDto {
    const capabilities = this.capabilityResolver.resolveForRemoteHost(host);
    const base = this.detailMapper.fromRemoteHost(host, capabilities);
    return {
      ...base,
      status: {
        ...base.status,
        storageHealth: null,
        logBackendState: null,
        degradedMode: host.status !== 'online',
        probeRuntimeKind: null,
        compatibilityTags: ['ssh', 'connection-health'],
      },
      availableActions: this.buildRemoteHostActions(
        capabilities.terminal.enabled,
        capabilities.files.enabled,
      ),
      latestValidationSummary: null,
    };
  }

  private buildWorkspaceItemFromServer(
    server: ServerWithStatusDto,
    latestValidationSummary: ResourceValidationSummaryDto | null,
  ): ResourceWorkspaceItemDto {
    const detail = this.buildServerDetail(server, latestValidationSummary);
    return {
      summary: serverToResourceSummary(server),
      serverType: server.serverType,
      group: server.serverGroup ?? null,
      description: server.description ?? null,
      status: detail.status,
      capabilities: detail.capabilities,
      availableActions: detail.availableActions,
      latestValidationSummary: detail.latestValidationSummary,
    };
  }

  private buildWorkspaceItemFromRemoteHost(
    host: RemoteHostDto,
  ): ResourceWorkspaceItemDto {
    const detail = this.buildRemoteHostDetail(host);
    return {
      summary: remoteHostToResourceSummary(host),
      serverType: null,
      group: null,
      description: host.description,
      status: detail.status,
      capabilities: detail.capabilities,
      availableActions: detail.availableActions,
      latestValidationSummary: null,
    };
  }

  private async getValidationSummaryMap(
    serverIds?: readonly string[],
  ): Promise<Map<string, ResourceValidationSummaryDto>> {
    const ids = serverIds ?? (await this.multiServer.listServers()).map((server) => server.id);
    const runsByServerId = await this.localValidationStore.getLatestRunsByServerIds(ids);
    return new Map(
      Array.from(runsByServerId.entries()).map(([serverId, run]) => [
        serverId,
        this.toValidationSummary(run),
      ]),
    );
  }

  private toValidationSummary(
    run: LocalValidationRunDto,
  ): ResourceValidationSummaryDto {
    return {
      state: run.status,
      verdict: this.resolveValidationVerdict(run.status),
      finishedAt: run.finishedAt ?? null,
      runId: run.id,
      failureReason: run.failureMessage ?? null,
    };
  }

  private resolveValidationVerdict(
    status: LocalValidationRunDto['status'],
  ): ResourceValidationSummaryDto['verdict'] {
    if (status === 'PASSED') {
      return 'passed';
    }
    if (
      status === 'PRECHECKING' ||
      status === 'PROVISIONING' ||
      status === 'STARTING' ||
      status === 'READY' ||
      status === 'RUNNING_SCENARIO' ||
      status === 'CLEANING'
    ) {
      return 'running';
    }
    if (status === 'CANCELLED') {
      return 'cancelled';
    }
    if (
      status === 'FAILED_PRECHECK' ||
      status === 'FAILED_PROVISION' ||
      status === 'FAILED_STARTUP' ||
      status === 'FAILED_SCENARIO' ||
      status === 'FAILED_RUNTIME'
    ) {
      return 'failed';
    }
    return 'unknown';
  }

  private buildServerActions(
    server: ServerWithStatusDto,
    terminalEnabled: boolean,
    filesEnabled: boolean,
  ): ResourceActionDto[] {
    if (server.serverType === 'external') {
      return [
        { key: 'ping', label: '重新探测', kind: 'secondary', enabled: true },
        { key: 'open-detail', label: '查看详情', kind: 'navigation', enabled: true },
        { key: 'validation-view', label: '查看验证', kind: 'navigation', enabled: true },
        { key: 'delete', label: '删除', kind: 'danger', enabled: true },
      ];
    }

    const running = server.runtimeStatus === 'running';
    const busy =
      server.runtimeStatus === 'starting' || server.runtimeStatus === 'stopping';

    return [
      {
        key: 'start',
        label: '启动',
        kind: 'primary',
        enabled: !running && !busy,
        reason: running ? '服务器已在运行' : busy ? '服务器正在变更状态' : null,
      },
      {
        key: 'stop',
        label: '停止',
        kind: 'secondary',
        enabled: running,
        reason: running ? null : '服务器未运行',
      },
      {
        key: 'restart',
        label: '重启',
        kind: 'secondary',
        enabled: running,
        reason: running ? null : '服务器未运行',
      },
      {
        key: 'interrupt',
        label: '强制中断',
        kind: 'danger',
        enabled: running || busy,
        reason: running || busy ? null : '当前没有可中断的活动进程',
      },
      {
        key: 'terminal',
        label: '终端',
        kind: 'navigation',
        enabled: terminalEnabled,
        reason: terminalEnabled ? null : '当前资源不支持控制台终端',
      },
      {
        key: 'files',
        label: '文件',
        kind: 'navigation',
        enabled: filesEnabled,
        reason: filesEnabled ? null : '当前资源不支持文件管理',
      },
      {
        key: 'validation',
        label: '验证',
        kind: 'navigation',
        enabled: true,
      },
      {
        key: 'delete',
        label: '删除',
        kind: 'danger',
        enabled: !running && !busy,
        reason: running || busy ? '停止服务器后才能删除' : null,
      },
    ];
  }

  private buildRemoteHostActions(
    terminalEnabled: boolean,
    filesEnabled: boolean,
  ): ResourceActionDto[] {
    return [
      { key: 'test-connection', label: '连接测试', kind: 'secondary', enabled: true },
      {
        key: 'ssh-terminal',
        label: 'SSH 终端',
        kind: 'navigation',
        enabled: terminalEnabled,
        reason: terminalEnabled ? null : '当前主机尚未建立可用 SSH 会话',
      },
      {
        key: 'files',
        label: '文件',
        kind: 'navigation',
        enabled: filesEnabled,
        reason: filesEnabled ? null : '当前版本未启用远程主机文件浏览',
      },
      { key: 'delete', label: '删除', kind: 'danger', enabled: true },
    ];
  }

  private matchesWorkspaceQuery(
    item: ResourceWorkspaceItemDto,
    query: ResourceWorkspaceQuery,
  ): boolean {
    const kind = query.kind?.trim();
    if (kind && item.summary.kind !== kind.toUpperCase()) {
      return false;
    }

    if (query.serverType && item.serverType !== query.serverType) {
      return false;
    }

    const status = query.status?.trim().toLowerCase();
    if (status) {
      const statusCandidates = [
        item.summary.status,
        item.status.state,
        item.status.health,
      ].map((value) => value.toLowerCase());
      if (!statusCandidates.includes(status)) {
        return false;
      }
    }

    const group = query.group?.trim().toLowerCase();
    if (group && !(item.group?.toLowerCase().includes(group))) {
      return false;
    }

    const tag = query.tag?.trim().toLowerCase();
    if (tag && !item.summary.tags.some((entry) => entry.toLowerCase() === tag)) {
      return false;
    }

    const keyword = query.q?.trim().toLowerCase();
    if (keyword) {
      const haystack = [
        item.summary.name,
        item.summary.host ?? '',
        item.description ?? '',
        item.group ?? '',
        ...item.summary.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  }

  private buildWorkspaceSummary(
    items: readonly ResourceWorkspaceItemDto[],
  ): ResourceWorkspaceSummaryDto {
    const byKind: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byServerType: Record<string, number> = {};

    for (const item of items) {
      byKind[item.summary.kind] = (byKind[item.summary.kind] ?? 0) + 1;
      byStatus[item.summary.status] = (byStatus[item.summary.status] ?? 0) + 1;
      const serverType = item.serverType ?? 'remote-host';
      byServerType[serverType] = (byServerType[serverType] ?? 0) + 1;
    }

    return {
      total: items.length,
      byKind,
      byStatus,
      byServerType,
    };
  }

  private resolveLogBackendState(mode: 'local-file' | 'loki' | 'hybrid'): LogBackendState {
    const hasLoki = Boolean(process.env['LOKI_BASE_URL']?.trim());
    if (mode === 'local-file') {
      return 'healthy';
    }
    if (mode === 'loki') {
      return hasLoki ? 'healthy' : 'unavailable';
    }
    return hasLoki ? 'healthy' : 'degraded';
  }

  private buildServerCompatibilityTags(
    server: ServerWithStatusDto,
    runtime: ReturnType<PlatformRuntimeService['getCapabilities']>,
  ): readonly string[] {
    const tags = [
      `server:${server.serverType}`,
      `storage:${runtime.storageDialect}`,
      `logs:${runtime.logBackendMode}`,
    ];

    if (server.serverType === 'managed') {
      tags.push(`probe:${runtime.probeRuntimeKind}`);
    }

    return tags;
  }
}

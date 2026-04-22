import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  MinecraftOpsSummaryDto,
  MinecraftQuickActionDto,
  PlayerOnlineDto,
  PluginStatusDto,
  WorldSummaryDto,
  ProbeConnectionStatusDto,
  MetricSnapshotDto,
  WorldMetricSnapshotDto,
} from '@jian-agent/shared-domain';
import { PluginRuntimeState } from '@jian-agent/shared-domain';
import { MultiServerService } from '../server-process/multi-server.service.js';
import { MetricStoreService } from '../storage/metric-store.service.js';
import { SpecializedContextMapper } from './specialized-context.mapper.js';

/**
 * Aggregation service for Minecraft operations workbench.
 *
 * Converges:
 *  - MultiServerService   (server status, ping, player counts)
 *  - MetricStoreService   (latest probe snapshot with player/plugin/world data)
 *
 * Produces a single MinecraftOpsSummaryDto for the workbench UI.
 */
@Injectable()
export class MinecraftOpsService {
  private readonly logger = new Logger(MinecraftOpsService.name);

  constructor(
    private readonly multiServer: MultiServerService,
    private readonly metricStore: MetricStoreService,
    private readonly contextMapper: SpecializedContextMapper,
  ) {}

  /**
   * Build a Minecraft ops summary for a managed server.
   */
  async buildSummary(serverId: string): Promise<MinecraftOpsSummaryDto> {
    const server = await this.multiServer.getServer(serverId);
    if (!server) {
      throw new NotFoundException(`Server ${serverId} not found`);
    }

    const serverRunning = server.runtimeStatus === 'running';

    // Parallel data gathering
    const [latestSnapshot, worldMetrics] = await Promise.all([
      this.metricStore.getLatest(serverId).catch((): MetricSnapshotDto | undefined => undefined),
      this.getWorldMetrics(serverId).catch((): WorldMetricSnapshotDto[] => []),
    ]);

    // Player list from probe snapshot
    const players: PlayerOnlineDto[] = latestSnapshot?.playerDetails
      ? latestSnapshot.playerDetails.map((p) => ({
          uuid: p.uuid,
          name: p.name,
          world: p.world,
          x: p.x,
          y: p.y,
          z: p.z,
          health: p.health,
          gamemode: p.gameMode,
          joinedAt: latestSnapshot.timestamp,
        }))
      : [];

    // Plugin list from probe snapshot
    const plugins: PluginStatusDto[] = latestSnapshot?.pluginDetails
      ? latestSnapshot.pluginDetails.map((p) => ({
          name: p.name,
          version: p.version,
          state: p.enabled ? PluginRuntimeState.RUNNING : PluginRuntimeState.STOPPED,
          enabled: p.enabled,
        }))
      : [];

    // World summary from world metrics
    const worlds: WorldSummaryDto[] = this.buildWorldSummaries(worldMetrics);

    // Probe connection status
    const probeStatus: ProbeConnectionStatusDto | null = latestSnapshot
      ? {
          probeId: serverId,
          status: 'READY',
          connectedAt: latestSnapshot.timestamp,
          lastPingMs: this.multiServer.getManagedPingLatency(serverId) ?? null,
          version: server.version ?? null,
        }
      : null;

    // Quick actions
    const quickActions = this.buildQuickActions(serverRunning);

    return {
      serverId,
      generatedAt: new Date().toISOString(),
      serverRunning,
      tps: latestSnapshot?.tps ?? null,
      players,
      maxPlayers: latestSnapshot?.maxPlayers ?? server.maxPlayers ?? 20,
      plugins,
      worlds,
      probeStatus,
      quickActions,
      serverVersion: server.version ?? null,
    };
  }

  // ── private helpers ──────────────────────────────────────────

  private async getWorldMetrics(
    serverId: string,
  ): Promise<readonly WorldMetricSnapshotDto[]> {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const now = new Date().toISOString();
    const metrics = await this.metricStore.queryWorldMetrics(serverId, since, now, 1);
    return metrics;
  }

  private buildWorldSummaries(
    worldMetrics: readonly WorldMetricSnapshotDto[],
  ): WorldSummaryDto[] {
    const summaryMap = new Map<string, WorldSummaryDto>();

    for (const wm of worldMetrics) {
      if (!summaryMap.has(wm.worldName)) {
        const environment = this.normaliseEnvironment(wm.environment);
        summaryMap.set(wm.worldName, {
          name: wm.worldName,
          environment,
          playerCount: 0,
          entityCount: wm.entityCount ?? 0,
          loadedChunks: wm.loadedChunks ?? 0,
          time: 0,
          weather: 'clear',
        });
      }
    }

    return [...summaryMap.values()];
  }

  private normaliseEnvironment(env: string): 'normal' | 'nether' | 'the_end' {
    const lower = env.toLowerCase();
    if (lower.includes('nether')) return 'nether';
    if (lower.includes('end')) return 'the_end';
    return 'normal';
  }

  private buildQuickActions(
    serverRunning: boolean,
  ): MinecraftQuickActionDto[] {
    const actions: MinecraftQuickActionDto[] = [
      {
        id: 'broadcast',
        label: 'Broadcast Message',
        command: 'say',
        enabled: serverRunning,
        requiresConfirmation: false,
      },
      {
        id: 'save-all',
        label: 'Save All Worlds',
        command: 'save-all',
        enabled: serverRunning,
        requiresConfirmation: false,
      },
      {
        id: 'save-off',
        label: 'Disable Auto-Save',
        command: 'save-off',
        enabled: serverRunning,
        requiresConfirmation: true,
      },
      {
        id: 'save-on',
        label: 'Enable Auto-Save',
        command: 'save-on',
        enabled: serverRunning,
        requiresConfirmation: false,
      },
      {
        id: 'list',
        label: 'List Players',
        command: 'list',
        enabled: serverRunning,
        requiresConfirmation: false,
      },
      {
        id: 'tps-check',
        label: 'Check TPS',
        command: 'tps',
        enabled: serverRunning,
        requiresConfirmation: false,
      },
    ];

    return actions;
  }
}

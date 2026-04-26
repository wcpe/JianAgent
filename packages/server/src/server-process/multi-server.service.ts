import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { serverConfigs } from '../storage/schema.js';
import { ProcessManagerService } from './process-manager.service.js';
import { ServerState } from '@jian-agent/shared-domain';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { McPingService, type McPingResult } from './mc-ping.service.js';

@Injectable()
export class MultiServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MultiServerService.name);
  private readonly externalPings = new Map<string, McPingResult>();
  private readonly managedPings = new Map<string, McPingResult>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly PING_INTERVAL = 15_000;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly processManager: ProcessManagerService,
    private readonly mcPing: McPingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshAllPings();
    this.pingTimer = setInterval(() => void this.refreshAllPings(), MultiServerService.PING_INTERVAL);
  }

  onModuleDestroy(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  private async refreshAllPings(): Promise<void> {
    const rows = this.db.select().from(serverConfigs).all();
    const externals = rows.filter((r) => r.serverType === 'external');
    for (const ext of externals) {
      try {
        const result = await this.mcPing.ping(ext.host, ext.port);
        this.externalPings.set(ext.id, result);
      } catch (err) {
        this.logger.debug(`Failed to ping external server ${ext.id}`, err);
        this.externalPings.set(ext.id, { online: false, motd: undefined, onlinePlayers: undefined, maxPlayers: undefined, version: undefined });
      }
    }
    // Also ping managed servers that are running
    const managed = rows.filter((r) => r.serverType !== 'external');
    for (const srv of managed) {
      const status = this.processManager.getStatus(srv.id);
      if (status.state === ServerState.RUNNING) {
        try {
          const result = await this.mcPing.ping(srv.host, srv.port);
          this.managedPings.set(srv.id, result);
        } catch (err) {
          this.logger.debug(`Failed to ping managed server ${srv.id}`, err);
          this.managedPings.delete(srv.id);
        }
      } else {
        this.managedPings.delete(srv.id);
      }
    }
  }

  async pingExternal(serverId: string): Promise<McPingResult | null> {
    const rows = this.db.select().from(serverConfigs).where(eq(serverConfigs.id, serverId)).limit(1).all();
    const row = rows[0];
    if (!row || row.serverType !== 'external') return null;
    try {
      const result = await this.mcPing.ping(row.host, row.port);
      this.externalPings.set(serverId, result);
      return result;
    } catch (err) {
      this.logger.debug(`Failed to ping external server ${serverId}`, err);
      return { online: false, motd: undefined, onlinePlayers: undefined, maxPlayers: undefined, version: undefined };
    }
  }

  async listServers(): Promise<readonly ServerWithStatusDto[]> {
    const rows = this.db.select().from(serverConfigs).all();
    return rows.map((r) => this.toDto(r));
  }

  async getServer(serverId: string): Promise<ServerWithStatusDto | null> {
    const rows = this.db
      .select()
      .from(serverConfigs)
      .where(eq(serverConfigs.id, serverId))
      .limit(1)
      .all();

    const row = rows[0];
    return row ? this.toDto(row) : null;
  }

  /** Returns ping latency for a managed server, or null if not running. */
  getManagedPingLatency(serverId: string): number | undefined {
    return this.managedPings.get(serverId)?.latencyMs;
  }

  /** Check whether an external server is currently reachable. */
  isExternalOnline(serverId: string): boolean {
    return this.externalPings.get(serverId)?.online === true;
  }

  private toDto(row: typeof serverConfigs.$inferSelect): ServerWithStatusDto {
    const serverType = (row.serverType as 'managed' | 'external') ?? 'managed';

    if (serverType === 'external') {
      const ping = this.externalPings.get(row.id);
      return {
        id: row.id,
        name: row.name,
        serverType,
        host: row.host,
        port: row.port,
        jarPath: row.jarPath,
        workDir: row.workDir,
        runtimeStatus: ping?.online ? 'running' : 'unknown',
        restartCount: 0,
        motd: ping?.motd,
        motdRaw: ping?.motdRaw,
        onlinePlayers: ping?.onlinePlayers,
        maxPlayers: ping?.maxPlayers,
        version: ping?.version,
        favicon: ping?.favicon,
        latencyMs: ping?.latencyMs,
        serverGroup: row.serverGroup,
        tags: JSON.parse(row.tags || '[]') as string[],
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    const status = this.processManager.getStatus(row.id);
    const runtimeStatus =
      status.state === ServerState.RUNNING ? 'running' as const :
      status.state === ServerState.STARTING ? 'starting' as const :
      status.state === ServerState.STOPPING ? 'stopping' as const :
      status.state === ServerState.CRASHED ? 'error' as const : 'stopped' as const;

    const ping = this.managedPings.get(row.id);

    return {
      id: row.id,
      name: row.name,
      serverType,
      host: row.host,
      port: row.port,
      jarPath: row.jarPath,
      workDir: row.workDir,
      runtimeStatus,
      pid: status.pid,
      uptime: status.uptime,
      restartCount: status.restartCount,
      motd: ping?.motd,
      motdRaw: ping?.motdRaw,
      onlinePlayers: ping?.onlinePlayers,
      maxPlayers: ping?.maxPlayers,
      version: ping?.version,
      favicon: ping?.favicon,
      latencyMs: ping?.latencyMs,
      serverGroup: row.serverGroup,
      tags: JSON.parse(row.tags || '[]') as string[],
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

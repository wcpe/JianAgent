import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../storage/drizzle.provider.js';
import { configSnapshots } from '../../storage/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '@jian-agent/shared-domain';

export interface ConfigSnapshotDto {
  readonly id: string;
  readonly serverId: string;
  readonly name: string;
  readonly configJson: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

@Injectable()
export class ConfigSnapshotService {
  private readonly logger = new Logger(ConfigSnapshotService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(serverId: string, config: ServerConfig): Promise<ConfigSnapshotDto> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const name = `auto-${now.slice(0, 19).replace('T', ' ')}`;

    await this.db.insert(configSnapshots).values({
      id,
      serverId,
      name,
      configJson: JSON.stringify(config),
      createdAt: now,
      createdBy: 'system',
    });

    return { id, serverId, name, configJson: JSON.stringify(config), createdAt: now, createdBy: 'system' };
  }

  async list(serverId: string): Promise<ConfigSnapshotDto[]> {
    const rows = await this.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.serverId, serverId))
      .all();

    return rows.map((r) => ({
      id: r.id,
      serverId: r.serverId,
      name: r.name,
      configJson: r.configJson,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }

  async getById(id: string): Promise<ConfigSnapshotDto> {
    const rows = await this.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.id, id))
      .limit(1)
      .all();

    const row = rows[0];
    if (!row) throw new NotFoundException(`Snapshot ${id} not found`);
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      configJson: row.configJson,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    };
  }

  async diff(snapshotId: string): Promise<{ added: string[]; removed: string[]; changed: string[] }> {
    const snapshot = await this.getById(snapshotId);
    const _snapshotConfig = JSON.parse(snapshot.configJson) as Record<string, unknown>;

    // Compare with current config in DB
    // We can't inject ConfigStoreService easily here, so just return the snapshot config for now
    // The frontend can do the diff client-side
    
    return { added: [], removed: [], changed: [] }; // placeholder — frontend will handle
  }
}

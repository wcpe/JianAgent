import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { savedBotConfigs } from '../storage/schema.js';
import { randomUUID } from 'node:crypto';

export interface SavedBotConfigDto {
  readonly id: string;
  readonly serverId: string;
  readonly namePrefix: string;
  readonly count: number;
  readonly behavior: string;
  readonly autoCreate: boolean;
  readonly rejoinStrategy: string;
  readonly maxRetries: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSavedBotConfigDto {
  readonly serverId: string;
  readonly namePrefix: string;
  readonly count: number;
  readonly behavior?: string;
  readonly autoCreate?: boolean;
  readonly rejoinStrategy?: string;
  readonly maxRetries?: number;
}

@Injectable()
export class SavedBotConfigService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async list(serverId?: string): Promise<SavedBotConfigDto[]> {
    const rows = serverId
      ? await this.db.select().from(savedBotConfigs).where(eq(savedBotConfigs.serverId, serverId))
      : await this.db.select().from(savedBotConfigs);

    return rows.map((r) => ({
      id: r.id,
      serverId: r.serverId,
      namePrefix: r.namePrefix,
      count: r.count,
      behavior: r.behavior,
      autoCreate: r.autoCreate,
      rejoinStrategy: r.rejoinStrategy,
      maxRetries: r.maxRetries,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async create(dto: CreateSavedBotConfigDto): Promise<SavedBotConfigDto> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = {
      id,
      serverId: dto.serverId,
      namePrefix: dto.namePrefix,
      count: dto.count,
      behavior: dto.behavior ?? 'idle',
      autoCreate: dto.autoCreate ?? true,
      rejoinStrategy: dto.rejoinStrategy ?? 'always',
      maxRetries: dto.maxRetries ?? 5,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(savedBotConfigs).values(row);
    return row;
  }

  async update(id: string, patch: Partial<CreateSavedBotConfigDto>): Promise<boolean> {
    const now = new Date().toISOString();
    const values: Record<string, unknown> = { updatedAt: now };
    if (patch.namePrefix !== undefined) values['namePrefix'] = patch.namePrefix;
    if (patch.count !== undefined) values['count'] = patch.count;
    if (patch.behavior !== undefined) values['behavior'] = patch.behavior;
    if (patch.autoCreate !== undefined) values['autoCreate'] = patch.autoCreate;
    if (patch.rejoinStrategy !== undefined) values['rejoinStrategy'] = patch.rejoinStrategy;
    if (patch.maxRetries !== undefined) values['maxRetries'] = patch.maxRetries;

    const result = await this.db
      .update(savedBotConfigs)
      .set(values)
      .where(eq(savedBotConfigs.id, id));
    return (result as any).changes > 0;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db
      .delete(savedBotConfigs)
      .where(eq(savedBotConfigs.id, id));
    return (result as any).changes > 0;
  }
}

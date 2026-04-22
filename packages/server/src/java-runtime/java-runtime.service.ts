import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { javaRuntimes } from '../storage/schema.js';
import type { JavaRuntimeDto, JavaRuntimeSelectionDto } from '@jian-agent/shared-domain';
import { JavaRuntimeSource } from '@jian-agent/shared-domain';
import { JavaRuntimeMapper } from './java-runtime.mapper.js';
import { JavaRuntimeDiscoveryService, type DiscoveredJavaRuntime } from './java-runtime-discovery.service.js';

export interface CreateJavaRuntimeInput {
  name: string;
  version?: string;
  vendor?: string;
  home: string;
  bin: string;
  source?: string;
  isDefault?: boolean;
  autoDiscovered?: boolean;
}

export interface UpdateJavaRuntimeInput {
  name?: string;
  version?: string;
  vendor?: string;
  home?: string;
  bin?: string;
  source?: string;
  isDefault?: boolean;
}

@Injectable()
export class JavaRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(JavaRuntimeService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly mapper: JavaRuntimeMapper,
    private readonly discovery: JavaRuntimeDiscoveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncDiscoveredRuntimes();
  }

  // --- CRUD ---

  async findAll(): Promise<JavaRuntimeDto[]> {
    const rows = this.db.select().from(javaRuntimes).all();
    return this.mapper.toDtoList(rows);
  }

  async findById(id: string): Promise<JavaRuntimeDto | undefined> {
    const rows = this.db.select().from(javaRuntimes).where(eq(javaRuntimes.id, id)).all();
    return rows[0] ? this.mapper.toDto(rows[0]) : undefined;
  }

  async create(input: CreateJavaRuntimeInput): Promise<JavaRuntimeDto> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = {
      id,
      name: input.name,
      version: input.version ?? '',
      vendor: input.vendor ?? '',
      home: input.home,
      bin: input.bin,
      source: input.source ?? JavaRuntimeSource.MANUAL,
      isDefault: input.isDefault ?? false,
      autoDiscovered: input.autoDiscovered ?? false,
      createdAt: now,
      updatedAt: now,
    };

    if (row.isDefault) {
      await this.clearDefault();
    }

    this.db.insert(javaRuntimes).values(row).run();
    this.logger.log(`Created Java runtime: ${row.name} (${row.bin})`);
    return this.mapper.toDto(row);
  }

  async update(id: string, input: UpdateJavaRuntimeInput): Promise<JavaRuntimeDto> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Java runtime not found: ${id}`);

    if (input.isDefault) {
      await this.clearDefault();
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.version !== undefined) updates['version'] = input.version;
    if (input.vendor !== undefined) updates['vendor'] = input.vendor;
    if (input.home !== undefined) updates['home'] = input.home;
    if (input.bin !== undefined) updates['bin'] = input.bin;
    if (input.source !== undefined) updates['source'] = input.source;
    if (input.isDefault !== undefined) updates['isDefault'] = input.isDefault;

    this.db.update(javaRuntimes).set(updates).where(eq(javaRuntimes.id, id)).run();
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Java runtime not found: ${id}`);
    this.db.delete(javaRuntimes).where(eq(javaRuntimes.id, id)).run();
    this.logger.log(`Deleted Java runtime: ${existing.name} (${id})`);
  }

  // --- Default Management ---

  async getDefault(): Promise<JavaRuntimeDto | undefined> {
    const rows = this.db
      .select()
      .from(javaRuntimes)
      .where(eq(javaRuntimes.isDefault, true))
      .all();
    return rows[0] ? this.mapper.toDto(rows[0]) : undefined;
  }

  async setDefault(id: string): Promise<JavaRuntimeDto> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Java runtime not found: ${id}`);
    await this.clearDefault();
    this.db
      .update(javaRuntimes)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(javaRuntimes.id, id))
      .run();
    this.logger.log(`Set default Java runtime: ${existing.name} (${id})`);
    return (await this.findById(id))!;
  }

  // --- Resolution ---

  async resolveJavaPath(runtimeId?: string | null): Promise<JavaRuntimeSelectionDto> {
    if (runtimeId) {
      const runtime = await this.findById(runtimeId);
      if (runtime) {
        return { runtimeId: runtime.id, resolvedJavaPath: runtime.bin };
      }
    }

    // Fallback to default
    const defaultRuntime = await this.getDefault();
    if (defaultRuntime) {
      return { runtimeId: defaultRuntime.id, resolvedJavaPath: defaultRuntime.bin };
    }

    // Last resort: system java
    return { runtimeId: '', resolvedJavaPath: 'java' };
  }

  // --- Discovery Sync ---

  async syncDiscoveredRuntimes(): Promise<JavaRuntimeDto[]> {
    const discovered = await this.discovery.discoverAll();
    const existing = await this.findAll();
    const existingBins = new Set(existing.map((r) => r.bin));
    const added: JavaRuntimeDto[] = [];

    for (const disc of discovered) {
      if (existingBins.has(disc.bin)) continue;
      const created = await this.create({
        name: disc.name,
        version: disc.version,
        vendor: disc.vendor,
        home: disc.home,
        bin: disc.bin,
        source: JavaRuntimeSource.DISCOVERED,
        autoDiscovered: true,
      });
      added.push(created);
    }

    // If no default set, pick the first discovered
    if (added.length > 0) {
      const currentDefault = await this.getDefault();
      if (!currentDefault) {
        await this.setDefault(added[0].id);
      }
    }

    return added;
  }

  // --- Private Helpers ---

  private async clearDefault(): Promise<void> {
    this.db
      .update(javaRuntimes)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(javaRuntimes.isDefault, true))
      .run();
  }
}

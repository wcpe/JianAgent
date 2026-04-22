import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { serverStartTemplates } from '../storage/schema.js';
import type {
  StartTemplateDto,
  CreateStartTemplateDto,
  UpdateStartTemplateDto,
} from '@jian-agent/shared-domain';

@Injectable()
export class StartTemplateService {
  private readonly logger = new Logger(StartTemplateService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(input: CreateStartTemplateDto): Promise<StartTemplateDto> {
    const now = new Date().toISOString();
    const id = randomUUID();

    const record = {
      id,
      name: input.name,
      javaPath: input.javaPath,
      jvmArgs: JSON.stringify(input.jvmArgs ?? []),
      serverArgs: JSON.stringify(input.serverArgs ?? []),
      envVars: JSON.stringify(input.envVars ?? {}),
      encoding: input.encoding ?? 'utf-8',
      runtimeId: input.runtimeId ?? '',
      templateGroup: input.templateGroup ?? '',
      templateDescription: input.description ?? '',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(serverStartTemplates).values(record);
    this.logger.log(`Created start template: ${input.name} (${id})`);

    return this.toDto(record);
  }

  async findAll(): Promise<readonly StartTemplateDto[]> {
    const rows = await this.db.select().from(serverStartTemplates);
    return rows.map((r) => this.toDto(r));
  }

  async findById(id: string): Promise<StartTemplateDto | undefined> {
    const rows = await this.db
      .select()
      .from(serverStartTemplates)
      .where(eq(serverStartTemplates.id, id));
    const row = rows[0];
    return row ? this.toDto(row) : undefined;
  }

  async update(id: string, input: UpdateStartTemplateDto): Promise<StartTemplateDto> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Start template not found: ${id}`);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.javaPath !== undefined) updates['javaPath'] = input.javaPath;
    if (input.jvmArgs !== undefined) updates['jvmArgs'] = JSON.stringify(input.jvmArgs);
    if (input.serverArgs !== undefined) updates['serverArgs'] = JSON.stringify(input.serverArgs);
    if (input.envVars !== undefined) updates['envVars'] = JSON.stringify(input.envVars);
    if (input.encoding !== undefined) updates['encoding'] = input.encoding;
    if (input.runtimeId !== undefined) updates['runtimeId'] = input.runtimeId;
    if (input.templateGroup !== undefined) updates['templateGroup'] = input.templateGroup;
    if (input.description !== undefined) updates['templateDescription'] = input.description;

    await this.db
      .update(serverStartTemplates)
      .set(updates)
      .where(eq(serverStartTemplates.id, id));

    this.logger.log(`Updated start template: ${id}`);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(serverStartTemplates).where(eq(serverStartTemplates.id, id));
    this.logger.log(`Deleted start template: ${id}`);
  }

  private toDto(row: {
    id: string;
    name: string;
    javaPath: string;
    jvmArgs: string;
    serverArgs: string;
    envVars: string;
    encoding: string;
    runtimeId: string;
    templateGroup: string;
    templateDescription: string;
    createdAt: string;
    updatedAt: string;
  }): StartTemplateDto {
    return {
      id: row.id,
      name: row.name,
      javaPath: row.javaPath,
      jvmArgs: JSON.parse(row.jvmArgs) as string[],
      serverArgs: JSON.parse(row.serverArgs) as string[],
      envVars: JSON.parse(row.envVars) as Record<string, string>,
      encoding: row.encoding,
      runtimeId: row.runtimeId,
      templateGroup: row.templateGroup,
      description: row.templateDescription,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

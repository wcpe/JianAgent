import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { serverStartTemplates } from '../storage/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { StartTemplateDto, CreateStartTemplateDto, UpdateStartTemplateDto } from '@jian-agent/shared-domain';

@Injectable()
export class StartTemplateService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async list(): Promise<readonly StartTemplateDto[]> {
    const rows = await this.db.select().from(serverStartTemplates);
    return rows.map((r) => this.toDto(r));
  }

  async getById(id: string): Promise<StartTemplateDto> {
    const rows = await this.db.select().from(serverStartTemplates).where(eq(serverStartTemplates.id, id));
    if (!rows[0]) throw new NotFoundException('Template not found');
    return this.toDto(rows[0]);
  }

  async create(request: CreateStartTemplateDto): Promise<StartTemplateDto> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(serverStartTemplates).values({
      id,
      name: request.name,
      javaPath: request.javaPath,
      jvmArgs: JSON.stringify(request.jvmArgs ?? []),
      serverArgs: JSON.stringify(request.serverArgs ?? []),
      envVars: JSON.stringify(request.envVars ?? {}),
      encoding: request.encoding ?? 'utf-8',
      runtimeId: request.runtimeId ?? '',
      templateGroup: request.templateGroup ?? '',
      templateDescription: request.description ?? '',
      createdAt: now,
      updatedAt: now,
    });

    return this.getById(id);
  }

  async update(id: string, request: UpdateStartTemplateDto): Promise<StartTemplateDto> {
    const existing = await this.getById(id);
    const now = new Date().toISOString();

    const values: Record<string, unknown> = { updatedAt: now };
    if (request.name !== undefined) values['name'] = request.name;
    if (request.javaPath !== undefined) values['javaPath'] = request.javaPath;
    if (request.jvmArgs !== undefined) values['jvmArgs'] = JSON.stringify(request.jvmArgs);
    if (request.serverArgs !== undefined) values['serverArgs'] = JSON.stringify(request.serverArgs);
    if (request.envVars !== undefined) values['envVars'] = JSON.stringify(request.envVars);
    if (request.encoding !== undefined) values['encoding'] = request.encoding;
    if (request.runtimeId !== undefined) values['runtimeId'] = request.runtimeId;
    if (request.templateGroup !== undefined) values['templateGroup'] = request.templateGroup;
    if (request.description !== undefined) values['templateDescription'] = request.description;

    await this.db.update(serverStartTemplates).set(values).where(eq(serverStartTemplates.id, id));
    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getById(id);
    await this.db.delete(serverStartTemplates).where(eq(serverStartTemplates.id, id));
  }

  private toDto(row: typeof serverStartTemplates.$inferSelect): StartTemplateDto {
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

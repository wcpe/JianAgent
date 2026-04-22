import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { sessionTemplates } from '../storage/schema.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';

interface CreateTemplateInput {
  readonly name: string;
  readonly description?: string;
  readonly botConfig: Record<string, unknown>;
  readonly phases: ReadonlyArray<Record<string, unknown>>;
}

interface UpdateTemplateInput {
  readonly name?: string;
  readonly description?: string;
  readonly botConfig?: Record<string, unknown>;
  readonly phases?: ReadonlyArray<Record<string, unknown>>;
}

@Injectable()
export class SessionTemplateService {
  private readonly logger = new Logger(SessionTemplateService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: any) {}

  async findAll() {
    return this.db.select().from(sessionTemplates);
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(sessionTemplates).where(eq(sessionTemplates.id, id));
    return row ?? null;
  }

  async create(input: CreateTemplateInput) {
    const now = new Date().toISOString();
    const id = `tmpl_${randomUUID().slice(0, 8)}`;
    const [row] = await this.db.insert(sessionTemplates).values({
      id,
      name: input.name,
      description: input.description ?? '',
      botConfig: JSON.stringify(input.botConfig),
      phases: JSON.stringify(input.phases),
      createdAt: now,
      updatedAt: now,
    }).returning();
    return row;
  }

  async update(id: string, input: UpdateTemplateInput) {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Template not found');
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.botConfig !== undefined) updates.botConfig = JSON.stringify(input.botConfig);
    if (input.phases !== undefined) updates.phases = JSON.stringify(input.phases);
    await this.db.update(sessionTemplates).set(updates).where(eq(sessionTemplates.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessionTemplates).where(eq(sessionTemplates.id, id));
  }
}

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { validationPlan } from '../storage/schema.js';
import type {
  ValidationPlanDto,
  CreateValidationPlanInput,
  UpdateValidationPlanInput,
} from './validation.types.js';

type ValidationPlanRow = typeof validationPlan.$inferSelect;

@Injectable()
export class ValidationPlanService {
  private readonly logger = new Logger(ValidationPlanService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(input: CreateValidationPlanInput): Promise<ValidationPlanDto> {
    const id = `vp_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const [plan] = await this.db
      .insert(validationPlan)
      .values({
        id,
        name: input.name,
        targetType: input.serverId ? 'server' : 'unknown',
        targetId: input.serverId ?? 'default',
        phasesJson: JSON.stringify(input.config?.phases ?? []),
        successThreshold: 1.0,
        triggerType: 'manual',
        createdAt: now,
      })
      .returning();

    return this.toDto(plan);
  }

  async findById(id: string): Promise<ValidationPlanDto | null> {
    const [plan] = await this.db
      .select()
      .from(validationPlan)
      .where(eq(validationPlan.id, id));

    return plan ? this.toDto(plan) : null;
  }

  async findAll(): Promise<ValidationPlanDto[]> {
    const plans = await this.db.select().from(validationPlan);
    return plans.map((plan) => this.toDto(plan));
  }

  async findByServerId(serverId: string): Promise<ValidationPlanDto[]> {
    const plans = await this.db
      .select()
      .from(validationPlan)
      .where(eq(validationPlan.targetId, serverId));

    return plans.map((plan) => this.toDto(plan));
  }

  async update(id: string, input: UpdateValidationPlanInput): Promise<ValidationPlanDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation plan ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.config !== undefined) updateData.phasesJson = JSON.stringify(input.config.phases ?? []);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const [updated] = await this.db
      .update(validationPlan)
      .set(updateData)
      .where(eq(validationPlan.id, id))
      .returning();

    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation plan ${id} not found`);
    }

    await this.db
      .delete(validationPlan)
      .where(eq(validationPlan.id, id));
  }

  private toDto(row: ValidationPlanRow): ValidationPlanDto {
    let phases: unknown[] = [];
    try {
      phases = JSON.parse(row.phasesJson);
    } catch (err) {
      this.logger.warn(`Failed to parse phases JSON for plan ${row.id}`, err);
    }

    return {
      id: row.id,
      name: row.name,
      description: '',
      serverId: row.targetId,
      type: (row.triggerType === 'manual' ? 'custom' : row.triggerType) as 'custom' | 'full' | 'quick',
      config: { phases },
      enabled: true,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    };
  }
}
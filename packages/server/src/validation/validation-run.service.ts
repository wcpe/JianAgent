import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { validationRun } from '../storage/schema.js';
import { ValidationRunMapper } from './validation-run.mapper.js';
import type { ValidationRunDto } from './validation.types.js';

@Injectable()
export class ValidationRunService {
  private readonly logger = new Logger(ValidationRunService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly mapper: ValidationRunMapper,
  ) {}

  async create(planId: string, serverId: string): Promise<ValidationRunDto> {
    const id = `vr_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const [run] = await this.db
      .insert(validationRun)
      .values({
        id,
        planId,
        sessionId: null,
        operationJobId: null,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        metricsJson: null,
        createdAt: now,
      })
      .returning();

    return this.mapper.toDto(run);
  }

  async start(id: string): Promise<ValidationRunDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation run ${id} not found`);
    }

    if (existing.status !== 'pending') {
      throw new BadRequestException(`Validation run ${id} is not in pending state`);
    }

    const now = new Date().toISOString();
    const [updated] = await this.db
      .update(validationRun)
      .set({
        status: 'running',
        startedAt: now,
      })
      .where(eq(validationRun.id, id))
      .returning();

    this.logger.log(`Validation run ${id} started`);
    return this.mapper.toDto(updated);
  }

  async complete(id: string, resultSummary: string, metrics?: Record<string, unknown>): Promise<ValidationRunDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation run ${id} not found`);
    }

    const now = new Date().toISOString();

    const [updated] = await this.db
      .update(validationRun)
      .set({
        status: 'completed',
        completedAt: now,
        metricsJson: metrics ? JSON.stringify(metrics) : null,
      })
      .where(eq(validationRun.id, id))
      .returning();

    this.logger.log(`Validation run ${id} completed`);
    return this.mapper.toDto(updated);
  }

  async fail(id: string, errorDetail: string): Promise<ValidationRunDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation run ${id} not found`);
    }

    const now = new Date().toISOString();

    const [updated] = await this.db
      .update(validationRun)
      .set({
        status: 'failed',
        completedAt: now,
        metricsJson: JSON.stringify({ error: errorDetail }),
      })
      .where(eq(validationRun.id, id))
      .returning();

    this.logger.error(`Validation run ${id} failed: ${errorDetail}`);
    return this.mapper.toDto(updated);
  }

  async cancel(id: string): Promise<ValidationRunDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Validation run ${id} not found`);
    }

    if (!['pending', 'running'].includes(existing.status)) {
      throw new BadRequestException(`Cannot cancel validation run in ${existing.status} state`);
    }

    const now = new Date().toISOString();
    const [updated] = await this.db
      .update(validationRun)
      .set({
        status: 'cancelled',
        completedAt: now,
      })
      .where(eq(validationRun.id, id))
      .returning();

    this.logger.log(`Validation run ${id} cancelled`);
    return this.mapper.toDto(updated);
  }

  async findById(id: string): Promise<ValidationRunDto | null> {
    const [run] = await this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.id, id));

    return run ? this.mapper.toDto(run) : null;
  }

  async findAll(): Promise<ValidationRunDto[]> {
    const runs = await this.db.select().from(validationRun);
    return this.mapper.toDtoList(runs);
  }

  async findByPlanId(planId: string): Promise<ValidationRunDto[]> {
    const runs = await this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.planId, planId));

    return this.mapper.toDtoList(runs);
  }

  async findByServerId(serverId: string): Promise<ValidationRunDto[]> {
    const runs = await this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.sessionId, serverId));

    return this.mapper.toDtoList(runs);
  }

  async findRunning(): Promise<ValidationRunDto[]> {
    const runs = await this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.status, 'running'));

    return this.mapper.toDtoList(runs);
  }
}
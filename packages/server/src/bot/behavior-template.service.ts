import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { sql } from 'drizzle-orm';
import { BotGroupService } from './bot-group.service.js';
import { BotOrchestratorService } from './bot-orchestrator.service.js';
import { randomUUID } from 'crypto';
import type {
  BehaviorTemplateDto,
  CreateBehaviorTemplateDto,
  UpdateBehaviorTemplateDto,
  BehaviorStepDto,
} from '@jian-agent/shared-domain';

@Injectable()
export class BehaviorTemplateService {
  private readonly logger = new Logger(BehaviorTemplateService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly groupService: BotGroupService,
    private readonly orchestrator: BotOrchestratorService,
  ) {}

  async create(input: CreateBehaviorTemplateDto): Promise<BehaviorTemplateDto> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.run(sql`INSERT INTO behavior_templates (id, name, steps, created_at, updated_at) VALUES (${id}, ${input.name}, ${JSON.stringify(input.steps)}, ${now}, ${now})`);

    return { id, name: input.name, steps: [...input.steps], createdAt: now, updatedAt: now };
  }

  async findAll(): Promise<readonly BehaviorTemplateDto[]> {
    try {
      const rows = this.db.all<Record<string, unknown>>(sql`SELECT id, name, steps, created_at, updated_at FROM behavior_templates ORDER BY created_at DESC`);
      return (rows ?? []).map(this.rowToDto);
    } catch (err) {
      this.logger.debug('Failed to list behavior templates', err);
      return [];
    }
  }

  async findById(id: string): Promise<BehaviorTemplateDto | undefined> {
    try {
      const rows = this.db.all<Record<string, unknown>>(sql`SELECT id, name, steps, created_at, updated_at FROM behavior_templates WHERE id = ${id} LIMIT 1`);
      return rows.length > 0 ? this.rowToDto(rows[0]) : undefined;
    } catch (err) {
      this.logger.debug(`Failed to find behavior template ${id}`, err);
      return undefined;
    }
  }

  async update(id: string, input: UpdateBehaviorTemplateDto): Promise<BehaviorTemplateDto | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const newName = input.name ?? existing.name;
    const newSteps = input.steps ?? existing.steps;

    this.db.run(sql`UPDATE behavior_templates SET name = ${newName}, steps = ${JSON.stringify(newSteps)}, updated_at = ${now} WHERE id = ${id}`);

    return { ...existing, name: newName, steps: [...newSteps], updatedAt: now };
  }

  async delete(id: string): Promise<void> {
    this.db.run(sql`DELETE FROM behavior_templates WHERE id = ${id}`);
  }

  async applyToGroup(templateId: string, groupId: string): Promise<void> {
    const template = await this.findById(templateId);
    if (!template) {
      this.logger.warn(`Template not found: ${templateId}`);
      return;
    }

    const botNames = await this.groupService.getGroupBots(groupId);
    if (botNames.length === 0) {
      this.logger.warn(`Group has no bots: ${groupId}`);
      return;
    }

    // Apply first step immediately; sequential steps would need a scheduler
    const firstStep = template.steps[0];
    if (!firstStep) return;

    for (const botName of botNames) {
      this.orchestrator.setBehavior(botName, firstStep.behavior, firstStep.params as Record<string, unknown>);
    }

    this.logger.log(
      `Applied template "${template.name}" step[0] to ${botNames.length} bots in group ${groupId}`,
    );
  }

  private rowToDto(row: Record<string, unknown>): BehaviorTemplateDto {
    return {
      id: row.id as string,
      name: row.name as string,
      steps: JSON.parse((row.steps as string) ?? '[]'),
      createdAt: (row.created_at ?? row.createdAt) as string,
      updatedAt: (row.updated_at ?? row.updatedAt) as string,
    };
  }
}

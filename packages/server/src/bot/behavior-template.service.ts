import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
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

    await this.db.run({
      sql: `INSERT INTO behavior_templates (id, name, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      params: [id, input.name, JSON.stringify(input.steps), now, now],
    } as any);

    return { id, name: input.name, steps: [...input.steps], createdAt: now, updatedAt: now };
  }

  async findAll(): Promise<readonly BehaviorTemplateDto[]> {
    try {
      const rows = await this.db.all({
        sql: `SELECT id, name, steps, created_at, updated_at FROM behavior_templates ORDER BY created_at DESC`,
        params: [],
      } as any);
      return ((rows as any[]) ?? []).map(this.rowToDto);
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<BehaviorTemplateDto | undefined> {
    try {
      const rows = await this.db.all({
        sql: `SELECT id, name, steps, created_at, updated_at FROM behavior_templates WHERE id = ? LIMIT 1`,
        params: [id],
      } as any);
      const arr = rows as any[];
      return arr.length > 0 ? this.rowToDto(arr[0]) : undefined;
    } catch {
      return undefined;
    }
  }

  async update(id: string, input: UpdateBehaviorTemplateDto): Promise<BehaviorTemplateDto | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const newName = input.name ?? existing.name;
    const newSteps = input.steps ?? existing.steps;

    await this.db.run({
      sql: `UPDATE behavior_templates SET name = ?, steps = ?, updated_at = ? WHERE id = ?`,
      params: [newName, JSON.stringify(newSteps), now, id],
    } as any);

    return { ...existing, name: newName, steps: [...newSteps], updatedAt: now };
  }

  async delete(id: string): Promise<void> {
    await this.db.run({
      sql: `DELETE FROM behavior_templates WHERE id = ?`,
      params: [id],
    } as any);
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

  private rowToDto(row: any): BehaviorTemplateDto {
    return {
      id: row.id,
      name: row.name,
      steps: JSON.parse(row.steps ?? '[]'),
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt,
    };
  }
}

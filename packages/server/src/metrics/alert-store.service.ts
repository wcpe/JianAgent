import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { alertRules, alerts } from '../storage/schema.js';
import type { AlertDto, AlertRuleDto, CreateAlertRuleDto, UpdateAlertRuleDto, AlertSummaryDto } from '@jian-agent/shared-domain';
import type { alertRules as alertRulesTable, alerts as alertsTable } from '../storage/schema.js';

type AlertRuleRow = typeof alertRulesTable.$inferSelect;
type AlertRow = typeof alertsTable.$inferSelect;
import { randomUUID } from 'node:crypto';

@Injectable()
export class AlertStoreService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  // --- Alert Rules ---

  async createRule(dto: CreateAlertRuleDto): Promise<AlertRuleDto> {
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      name: dto.name,
      metric: dto.metric,
      operator: dto.operator,
      threshold: dto.threshold,
      level: dto.level,
      enabled: true,
      cooldownSeconds: dto.cooldownSeconds ?? 60,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(alertRules).values(row);
    return this.toRuleDto(row);
  }

  async listRules(): Promise<AlertRuleDto[]> {
    const rows = await this.db.select().from(alertRules);
    return rows.map((r) => this.toRuleDto(r));
  }

  async getRule(id: string): Promise<AlertRuleDto | undefined> {
    const rows = await this.db.select().from(alertRules).where(eq(alertRules.id, id));
    return rows[0] ? this.toRuleDto(rows[0]) : undefined;
  }

  async updateRule(id: string, dto: UpdateAlertRuleDto): Promise<AlertRuleDto | undefined> {
    const existing = await this.getRule(id);
    if (!existing) return undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.name !== undefined) updates['name'] = dto.name;
    if (dto.threshold !== undefined) updates['threshold'] = dto.threshold;
    if (dto.level !== undefined) updates['level'] = dto.level;
    if (dto.enabled !== undefined) updates['enabled'] = dto.enabled;
    if (dto.cooldownSeconds !== undefined) updates['cooldownSeconds'] = dto.cooldownSeconds;

    await this.db.update(alertRules).set(updates).where(eq(alertRules.id, id));
    return this.getRule(id);
  }

  async deleteRule(id: string): Promise<boolean> {
    await this.db.delete(alertRules).where(eq(alertRules.id, id));
    return true;
  }

  async getEnabledRules(): Promise<AlertRuleDto[]> {
    const rows = await this.db.select().from(alertRules).where(eq(alertRules.enabled, true));
    return rows.map((r) => this.toRuleDto(r));
  }

  private toRuleDto(row: AlertRuleRow): AlertRuleDto {
    return {
      id: row.id,
      name: row.name,
      metric: row.metric as AlertRuleDto['metric'],
      operator: row.operator as AlertRuleDto['operator'],
      threshold: row.threshold,
      level: row.level as AlertRuleDto['level'],
      enabled: row.enabled,
      cooldownSeconds: row.cooldownSeconds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // --- Alerts ---

  async insertAlert(dto: Omit<AlertDto, 'id'>): Promise<string> {
    const id = randomUUID();
    await this.db.insert(alerts).values({
      id,
      timestamp: dto.timestamp,
      level: dto.level,
      ruleId: dto.ruleId,
      ruleName: dto.ruleName,
      message: dto.message,
      serverId: dto.serverId ?? null,
      value: dto.value ?? null,
      threshold: dto.threshold ?? null,
      acknowledged: dto.acknowledged,
    });
    return id;
  }

  async listAlerts(limit = 50): Promise<AlertDto[]> {
    const rows = await this.db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.timestamp))
      .limit(limit);
    return rows.map((r) => this.toAlertDto(r));
  }

  async acknowledgeAlert(id: string): Promise<boolean> {
    await this.db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id));
    return true;
  }

  async getSummary(): Promise<AlertSummaryDto> {
    const active = await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.acknowledged, false));

    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const a of active) {
      switch (a.level) {
        case 'CRITICAL': criticalCount++; break;
        case 'WARNING': warningCount++; break;
        case 'INFO': infoCount++; break;
      }
    }

    return { totalActive: active.length, criticalCount, warningCount, infoCount };
  }

  private toAlertDto(row: AlertRow): AlertDto {
    return {
      id: row.id,
      timestamp: row.timestamp,
      level: row.level as AlertDto['level'],
      ruleId: row.ruleId,
      ruleName: row.ruleName,
      message: row.message,
      serverId: row.serverId ?? undefined,
      value: row.value ?? undefined,
      threshold: row.threshold ?? undefined,
      acknowledged: row.acknowledged,
    };
  }
}

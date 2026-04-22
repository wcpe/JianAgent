import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { randomUUID } from 'crypto';
import type { BotGroupDto } from '@jian-agent/shared-domain';

@Injectable()
export class BotGroupService {
  private readonly logger = new Logger(BotGroupService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
  ) {}

  async createGroup(
    sessionId: string,
    name: string,
    botNames: readonly string[],
  ): Promise<BotGroupDto> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const botNamesJson = JSON.stringify(botNames);

    await this.db.run({
      sql: `INSERT INTO bot_groups (id, session_id, name, bot_names, created_at) VALUES (?, ?, ?, ?, ?)`,
      params: [id, sessionId, name, botNamesJson, createdAt],
    } as any);

    return { id, sessionId, name, botNames: [...botNames], createdAt };
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.db.run({
      sql: `DELETE FROM bot_groups WHERE id = ?`,
      params: [groupId],
    } as any);
  }

  async addToGroup(groupId: string, botNames: readonly string[]): Promise<BotGroupDto | undefined> {
    const group = await this.findById(groupId);
    if (!group) return undefined;

    const merged = [...new Set([...group.botNames, ...botNames])];
    await this.db.run({
      sql: `UPDATE bot_groups SET bot_names = ? WHERE id = ?`,
      params: [JSON.stringify(merged), groupId],
    } as any);

    return { ...group, botNames: merged };
  }

  async removeFromGroup(groupId: string, botNames: readonly string[]): Promise<BotGroupDto | undefined> {
    const group = await this.findById(groupId);
    if (!group) return undefined;

    const removeSet = new Set(botNames);
    const remaining = group.botNames.filter((n) => !removeSet.has(n));
    await this.db.run({
      sql: `UPDATE bot_groups SET bot_names = ? WHERE id = ?`,
      params: [JSON.stringify(remaining), groupId],
    } as any);

    return { ...group, botNames: remaining };
  }

  async listGroups(sessionId: string): Promise<readonly BotGroupDto[]> {
    try {
      const rows = await this.db.all({
        sql: `SELECT id, session_id, name, bot_names, created_at FROM bot_groups WHERE session_id = ? ORDER BY created_at`,
        params: [sessionId],
      } as any);
      return ((rows as any[]) ?? []).map(this.rowToDto);
    } catch {
      return [];
    }
  }

  async getGroupBots(groupId: string): Promise<readonly string[]> {
    const group = await this.findById(groupId);
    return group?.botNames ?? [];
  }

  private async findById(groupId: string): Promise<BotGroupDto | undefined> {
    try {
      const rows = await this.db.all({
        sql: `SELECT id, session_id, name, bot_names, created_at FROM bot_groups WHERE id = ? LIMIT 1`,
        params: [groupId],
      } as any);
      const arr = rows as any[];
      return arr.length > 0 ? this.rowToDto(arr[0]) : undefined;
    } catch {
      return undefined;
    }
  }

  private rowToDto(row: any): BotGroupDto {
    return {
      id: row.id,
      sessionId: row.session_id ?? row.sessionId,
      name: row.name,
      botNames: JSON.parse(row.bot_names ?? row.botNames ?? '[]'),
      createdAt: row.created_at ?? row.createdAt,
    };
  }
}

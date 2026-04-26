import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { sql } from 'drizzle-orm';
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

    this.db.run(sql`INSERT INTO bot_groups (id, session_id, name, bot_names, created_at) VALUES (${id}, ${sessionId}, ${name}, ${botNamesJson}, ${createdAt})`);

    return { id, sessionId, name, botNames: [...botNames], createdAt };
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.db.run(sql`DELETE FROM bot_groups WHERE id = ${groupId}`);
  }

  async addToGroup(groupId: string, botNames: readonly string[]): Promise<BotGroupDto | undefined> {
    const group = await this.findById(groupId);
    if (!group) return undefined;

    const merged = [...new Set([...group.botNames, ...botNames])];
    this.db.run(sql`UPDATE bot_groups SET bot_names = ${JSON.stringify(merged)} WHERE id = ${groupId}`);

    return { ...group, botNames: merged };
  }

  async removeFromGroup(groupId: string, botNames: readonly string[]): Promise<BotGroupDto | undefined> {
    const group = await this.findById(groupId);
    if (!group) return undefined;

    const removeSet = new Set(botNames);
    const remaining = group.botNames.filter((n) => !removeSet.has(n));
    this.db.run(sql`UPDATE bot_groups SET bot_names = ${JSON.stringify(remaining)} WHERE id = ${groupId}`);

    return { ...group, botNames: remaining };
  }

  async listGroups(sessionId: string): Promise<readonly BotGroupDto[]> {
    try {
      const rows = this.db.all<Record<string, unknown>>(sql`SELECT id, session_id, name, bot_names, created_at FROM bot_groups WHERE session_id = ${sessionId} ORDER BY created_at`);
      return (rows ?? []).map(this.rowToDto);
    } catch (err) {
      this.logger.debug(`Failed to list bot groups for session ${sessionId}`, err);
      return [];
    }
  }

  async getGroupBots(groupId: string): Promise<readonly string[]> {
    const group = await this.findById(groupId);
    return group?.botNames ?? [];
  }

  private async findById(groupId: string): Promise<BotGroupDto | undefined> {
    try {
      const rows = this.db.all<Record<string, unknown>>(sql`SELECT id, session_id, name, bot_names, created_at FROM bot_groups WHERE id = ${groupId} LIMIT 1`);
      return rows.length > 0 ? this.rowToDto(rows[0]) : undefined;
    } catch (err) {
      this.logger.debug(`Failed to find bot group ${groupId}`, err);
      return undefined;
    }
  }

  private rowToDto(row: Record<string, unknown>): BotGroupDto {
    return {
      id: row.id as string,
      sessionId: (row.session_id ?? row.sessionId) as string,
      name: row.name as string,
      botNames: JSON.parse((row.bot_names ?? row.botNames ?? '[]') as string),
      createdAt: (row.created_at ?? row.createdAt) as string,
    };
  }
}

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessionTable = sqliteTable('session', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  serverId: text('server_id').notNull(),
  botConfigId: text('bot_config_id').notNull(),
  state: text('state').notNull().default('CREATED'),
  currentPhase: text('current_phase'),
  phasesJson: text('phases_json'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const botConfigTable = sqliteTable('bot_config', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  namePrefix: text('name_prefix').notNull(),
  count: integer('count').notNull(),
  behavior: text('behavior').notNull().default('idle'),
  behaviorParams: text('behavior_params').default('{}'),
  createdAt: text('created_at').notNull(),
});

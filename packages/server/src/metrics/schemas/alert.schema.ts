import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  ruleId: text('rule_id').notNull(),
  ruleName: text('rule_name').notNull(),
  message: text('message').notNull(),
  serverId: text('server_id'),
  value: real('value'),
  threshold: real('threshold'),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
});

export type AlertRow = typeof alerts.$inferSelect;
export type InsertAlertRow = typeof alerts.$inferInsert;

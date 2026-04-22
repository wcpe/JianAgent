import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  metric: text('metric').notNull(),
  operator: text('operator').notNull(),
  threshold: real('threshold').notNull(),
  level: text('level').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type AlertRuleRow = typeof alertRules.$inferSelect;
export type InsertAlertRuleRow = typeof alertRules.$inferInsert;

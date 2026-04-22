import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const validationPlanTable = sqliteTable('validation_plan', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  serverId: text('server_id').notNull(),
  type: text('type').notNull().default('full'),
  configJson: text('config_json').notNull().default('{}'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const logEntries = sqliteTable('log_entries', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  source: text('source').notNull(),
  module: text('module').notNull(),
  message: text('message').notNull(),
  serverId: text('server_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type LogEntryRow = typeof logEntries.$inferSelect;
export type InsertLogEntryRow = typeof logEntries.$inferInsert;

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const validationRunTable = sqliteTable('validation_run', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  serverId: text('server_id').notNull(),
  status: text('status').notNull().default('PENDING'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  durationMs: integer('duration_ms'),
  resultSummary: text('result_summary'),
  errorDetail: text('error_detail'),
  metricsJson: text('metrics_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
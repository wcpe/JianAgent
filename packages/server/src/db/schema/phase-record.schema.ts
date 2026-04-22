import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const phaseRecordTable = sqliteTable('phase_record', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  phase: text('phase').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  durationMs: integer('duration_ms'),
  botCount: integer('bot_count').notNull(),
  behavior: text('behavior').notNull(),
  avgTps: real('avg_tps'),
  peakMemoryMb: integer('peak_memory_mb'),
  notes: text('notes'),
});

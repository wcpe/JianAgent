import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const diagnosticFiles = sqliteTable(
  'diagnostic_files',
  {
    id: text('id').primaryKey(),
    pid: integer('pid').notNull(),
    processName: text('process_name').notNull(),
    fileType: text('file_type').notNull(), // 'thread-dump' | 'heap-dump' | 'jfr' | 'cpu-sample'
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    createdAt: text('created_at').notNull(),
    description: text('description').notNull().default(''),
  },
  (table) => ({
    pidIdx: index('diagnostic_files_pid_idx').on(table.pid),
    fileTypeIdx: index('diagnostic_files_file_type_idx').on(table.fileType),
    createdAtIdx: index('diagnostic_files_created_at_idx').on(table.createdAt),
  }),
);

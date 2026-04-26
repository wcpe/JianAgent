import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { getCoreSchemaSql, getControlPlaneSchemaSql, getAuxiliarySchemaSql, runConditionalMigrations } from './migrations.js';

export const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');

export type DrizzleDb = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

@Injectable()
export class DrizzleProvider implements OnModuleDestroy {
  public readonly db: DrizzleDb;
  private readonly sqlite: Database.Database;

  constructor() {
    const dbPath = process.env['DB_PATH'] ?? './data/jian-agent.db';
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('busy_timeout = 5000');
    this.db = drizzle(this.sqlite, { schema });
    this.runMigrations();
  }

  private runMigrations(): void {
    this.sqlite.exec(getCoreSchemaSql());
    this.sqlite.exec(getControlPlaneSchemaSql());
    this.sqlite.exec(getAuxiliarySchemaSql());
    runConditionalMigrations(this.sqlite);
  }

  onModuleDestroy(): void {
    this.sqlite.close();
  }
}

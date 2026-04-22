import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DrizzleProvider } from '../drizzle.provider.js';
import { serverConfigs, playerPopulations } from '../schema.js';

describe('DrizzleProvider', () => {
  const originalDbPath = process.env['DB_PATH'];
  let tempDir: string | undefined;
  let provider: DrizzleProvider | undefined;

  afterEach(() => {
    provider?.onModuleDestroy();
    provider = undefined;

    if (originalDbPath === undefined) {
      delete process.env['DB_PATH'];
    } else {
      process.env['DB_PATH'] = originalDbPath;
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('adds the is_active column for existing server_configs tables', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'jian-agent-db-'));
    const dbPath = join(tempDir, 'legacy.db');

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE server_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        java_path TEXT NOT NULL,
        jar_path TEXT NOT NULL,
        work_dir TEXT NOT NULL,
        jvm_args TEXT NOT NULL DEFAULT '[]',
        server_args TEXT NOT NULL DEFAULT '[]',
        env_vars TEXT NOT NULL DEFAULT '{}',
        encoding TEXT NOT NULL DEFAULT 'utf-8',
        auto_restart INTEGER NOT NULL DEFAULT 0,
        max_restarts INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    legacyDb.close();

    process.env['DB_PATH'] = dbPath;
    provider = new DrizzleProvider();

    expect(() => provider!.db.select().from(serverConfigs).all()).not.toThrow();

    provider.onModuleDestroy();
    provider = undefined;

    const migratedDb = new Database(dbPath, { readonly: true });
    const columns = migratedDb
      .prepare("PRAGMA table_info('server_configs')")
      .all() as Array<{ name: string }>;
    migratedDb.close();

    expect(columns.some((column) => column.name === 'is_active')).toBe(true);
    expect(columns.some((column) => column.name === 'server_type')).toBe(true);
    expect(columns.some((column) => column.name === 'runtime_id')).toBe(true);
  });

  it('creates the player_populations table on startup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'jian-agent-db-'));
    const dbPath = join(tempDir, 'fresh.db');

    process.env['DB_PATH'] = dbPath;
    provider = new DrizzleProvider();

    // Verify table exists by inserting and querying
    expect(() => provider!.db.select().from(playerPopulations).all()).not.toThrow();

    provider.onModuleDestroy();
    provider = undefined;

    const db = new Database(dbPath, { readonly: true });
    const columns = db
      .prepare("PRAGMA table_info('player_populations')")
      .all() as Array<{ name: string }>;
    db.close();

    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('server_id');
    expect(colNames).toContain('server_name');
    expect(colNames).toContain('timestamp');
    expect(colNames).toContain('online_players');
    expect(colNames).toContain('max_players');
  });

  it('adds the name column for existing local_validation_runs tables', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'jian-agent-db-'));
    const dbPath = join(tempDir, 'legacy-validation.db');

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE local_validation_runs (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        server_id TEXT,
        status TEXT NOT NULL,
        paper_version TEXT,
        scenario_pack_id TEXT NOT NULL,
        requested_bot_count INTEGER NOT NULL,
        effective_bot_count INTEGER NOT NULL DEFAULT 0,
        requested_by TEXT NOT NULL,
        failure_code TEXT,
        failure_message TEXT,
        keep_server_running INTEGER NOT NULL DEFAULT 0,
        keep_workspace INTEGER NOT NULL DEFAULT 0,
        workspace_path TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    legacyDb.close();

    process.env['DB_PATH'] = dbPath;
    provider = new DrizzleProvider();

    expect(() => provider!.db.select().from(serverConfigs).all()).not.toThrow();

    provider.onModuleDestroy();
    provider = undefined;

    const migratedDb = new Database(dbPath, { readonly: true });
    const columns = migratedDb
      .prepare("PRAGMA table_info('local_validation_runs')")
      .all() as Array<{ name: string }>;
    migratedDb.close();

    expect(columns.some((column) => column.name === 'name')).toBe(true);
  });
});

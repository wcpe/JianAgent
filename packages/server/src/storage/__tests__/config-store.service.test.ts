import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import { ConfigStoreService } from '../config-store.service.js';

describe('ConfigStoreService', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;
  let service: ConfigStoreService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE server_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_type TEXT NOT NULL DEFAULT 'managed',
        java_path TEXT NOT NULL DEFAULT '',
        jar_path TEXT NOT NULL DEFAULT '',
        work_dir TEXT NOT NULL DEFAULT '',
        jvm_args TEXT NOT NULL DEFAULT '[]',
        server_args TEXT NOT NULL DEFAULT '[]',
        env_vars TEXT NOT NULL DEFAULT '{}',
        encoding TEXT NOT NULL DEFAULT 'utf-8',
        auto_restart INTEGER NOT NULL DEFAULT 0,
        max_restarts INTEGER NOT NULL DEFAULT 3,
        is_active INTEGER NOT NULL DEFAULT 0,
        host TEXT NOT NULL DEFAULT 'localhost',
        port INTEGER NOT NULL DEFAULT 25565,
        ssh_host TEXT NOT NULL DEFAULT '',
        ssh_port INTEGER NOT NULL DEFAULT 22,
        ssh_username TEXT NOT NULL DEFAULT '',
        ssh_auth_type TEXT NOT NULL DEFAULT 'password',
        ssh_password TEXT NOT NULL DEFAULT '',
        ssh_key_path TEXT NOT NULL DEFAULT '',
        ssh_passphrase TEXT NOT NULL DEFAULT '',
        server_dir TEXT NOT NULL DEFAULT '',
        logs_path TEXT NOT NULL DEFAULT 'logs',
        runtime_id TEXT NOT NULL DEFAULT '',
        probe_version TEXT NOT NULL DEFAULT '',
        pre_start_command TEXT NOT NULL DEFAULT '',
        post_start_command TEXT NOT NULL DEFAULT '',
        pre_stop_command TEXT NOT NULL DEFAULT '',
        post_stop_command TEXT NOT NULL DEFAULT '',
        script_timeout_ms INTEGER NOT NULL DEFAULT 30000,
        ready_pattern TEXT NOT NULL DEFAULT '',
        ready_timeout_ms INTEGER NOT NULL DEFAULT 120000,
        server_group TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    service = new ConfigStoreService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should create and retrieve a config', async () => {
    const config = await service.create({
      name: 'test-server',
      javaPath: '/usr/bin/java',
      jarPath: '/srv/server.jar',
      workDir: '/srv',
    });

    expect(config.name).toBe('test-server');
    expect(config.javaPath).toBe('/usr/bin/java');
    expect(config.id).toBeDefined();

    const found = await service.findById(config.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('test-server');
  });

  it('should update a config immutably', async () => {
    const config = await service.create({
      name: 'test-server',
      javaPath: '/usr/bin/java',
      jarPath: '/srv/server.jar',
      workDir: '/srv',
    });

    const updated = await service.update(config.id, { name: 'renamed-server' });
    expect(updated.name).toBe('renamed-server');
    expect(updated.javaPath).toBe('/usr/bin/java');
    expect(updated.id).toBe(config.id);
  });

  it('should list all configs', async () => {
    await service.create({ name: 'a', javaPath: 'j', jarPath: 'p', workDir: 'w' });
    await service.create({ name: 'b', javaPath: 'j', jarPath: 'p', workDir: 'w' });

    const all = await service.findAll();
    expect(all).toHaveLength(2);
  });

  it('should delete a config', async () => {
    const config = await service.create({ name: 'a', javaPath: 'j', jarPath: 'p', workDir: 'w' });
    await service.delete(config.id);
    const found = await service.findById(config.id);
    expect(found).toBeUndefined();
  });
});

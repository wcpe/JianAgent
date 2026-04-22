import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import { AuditStoreService } from '../audit-store.service.js';

describe('AuditStoreService', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;
  let service: AuditStoreService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE audit_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        operation TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        params TEXT NOT NULL DEFAULT '',
        success INTEGER NOT NULL,
        ip TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_audit_timestamp ON audit_records(timestamp);
      CREATE INDEX idx_audit_user_id ON audit_records(user_id);
    `);
    service = new AuditStoreService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should create an audit record', async () => {
    const record = await service.create({
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      username: 'admin',
      operation: 'server.start',
      target: 'server-1',
      params: '{}',
      success: true,
      ip: '127.0.0.1',
    });

    expect(record.id).toBeDefined();
    expect(record.operation).toBe('server.start');
  });

  it('should query records with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        userId: 'user-1',
        username: 'admin',
        operation: 'test',
        target: '',
        params: '',
        success: true,
        ip: '127.0.0.1',
      });
    }

    const result = await service.query({ page: 1, limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
  });

  it('should filter by userId', async () => {
    await service.create({
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      username: 'admin',
      operation: 'test',
      target: '',
      params: '',
      success: true,
      ip: '',
    });
    await service.create({
      timestamp: new Date().toISOString(),
      userId: 'user-2',
      username: 'other',
      operation: 'test',
      target: '',
      params: '',
      success: true,
      ip: '',
    });

    const result = await service.query({ userId: 'user-1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.userId).toBe('user-1');
  });
});

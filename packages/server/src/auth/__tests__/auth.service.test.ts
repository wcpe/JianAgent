import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { AuthService, readBootstrapAdminConfig } from '../auth.service.js';
import { RoleLevel } from '@jian-agent/shared-domain';

describe('AuthService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let service: AuthService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
    service = new AuthService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should register a new user and return user info', async () => {
    const result = await service.register({
      username: 'admin',
      password: 'secret123',
      role: RoleLevel.ADMIN,
    });

    expect(result.username).toBe('admin');
    expect(result.role).toBe(RoleLevel.ADMIN);
    expect(result.id).toBeDefined();
  });

  it('should reject duplicate username', async () => {
    await service.register({ username: 'admin', password: 'secret123' });
    await expect(
      service.register({ username: 'admin', password: 'other' })
    ).rejects.toThrow();
  });

  it('should login with correct credentials and return a JWT', async () => {
    await service.register({ username: 'admin', password: 'secret123' });
    const result = await service.login({ username: 'admin', password: 'secret123' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.user.username).toBe('admin');
  });

  it('should reject login with wrong password', async () => {
    await service.register({ username: 'admin', password: 'secret123' });
    await expect(
      service.login({ username: 'admin', password: 'wrong' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('should verify a valid token', async () => {
    await service.register({ username: 'admin', password: 'secret123' });
    const { token } = await service.login({ username: 'admin', password: 'secret123' });
    const payload = service.verifyToken(token);

    expect(payload.username).toBe('admin');
    expect(payload.sub).toBeDefined();
  });

  it('should use local bootstrap defaults outside production', () => {
    expect(readBootstrapAdminConfig({ NODE_ENV: 'development' })).toEqual({
      enabled: true,
      username: 'admin',
      password: 'admin123456',
    });
  });

  it('should disable bootstrap by default in production', () => {
    expect(readBootstrapAdminConfig({ NODE_ENV: 'production' })).toEqual({
      enabled: false,
      username: 'admin',
      password: 'admin123456',
    });
  });

  it('should bootstrap a local admin account when the database is empty', async () => {
    await service.ensureBootstrapAdmin({ NODE_ENV: 'development' });
    const result = await service.login({ username: 'admin', password: 'admin123456' });

    expect(result.user.username).toBe('admin');
    expect(result.user.role).toBe(RoleLevel.ADMIN);
  });

  it('should not bootstrap a second user when the database already has users', async () => {
    await service.register({ username: 'existing', password: 'secret123', role: RoleLevel.VIEWER });
    await service.ensureBootstrapAdmin({ NODE_ENV: 'development' });

    const rows = db.select().from(schema.users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.username).toBe('existing');
  });
});

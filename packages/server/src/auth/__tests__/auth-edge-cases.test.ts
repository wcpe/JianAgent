import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { AuthService, readJwtConfig, readBootstrapAdminConfig } from '../auth.service.js';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

// ── readJwtConfig edge cases ──────────────────────────────────────────────────

describe('readJwtConfig', () => {
  it('returns dev fallback when no JWT_SECRET and NODE_ENV is undefined', () => {
    const config = readJwtConfig({});
    expect(config.secret).toBe('jian-agent-dev-secret-do-not-use-in-production');
  });

  it('throws when NODE_ENV=production and no JWT_SECRET', () => {
    expect(() => readJwtConfig({ NODE_ENV: 'production' })).toThrow(
      'JWT_SECRET environment variable is required in production',
    );
  });

  it('uses provided JWT_SECRET when set', () => {
    const config = readJwtConfig({ JWT_SECRET: 'my-strong-secret' });
    expect(config.secret).toBe('my-strong-secret');
  });

  it('trims whitespace from JWT_SECRET', () => {
    const config = readJwtConfig({ JWT_SECRET: '  padded-secret  ' });
    expect(config.secret).toBe('padded-secret');
  });

  it('treats whitespace-only JWT_SECRET as absent and falls back to dev secret', () => {
    const config = readJwtConfig({ JWT_SECRET: '   ' });
    expect(config.secret).toBe('jian-agent-dev-secret-do-not-use-in-production');
  });
});

// ── readBootstrapAdminConfig edge cases ──────────────────────────────────────

describe('readBootstrapAdminConfig', () => {
  it('respects JIAN_AGENT_BOOTSTRAP_ADMIN=false to disable bootstrap', () => {
    const config = readBootstrapAdminConfig({
      NODE_ENV: 'development',
      JIAN_AGENT_BOOTSTRAP_ADMIN: 'false',
    });
    expect(config.enabled).toBe(false);
  });

  it('respects JIAN_AGENT_BOOTSTRAP_ADMIN=0 to disable bootstrap', () => {
    const config = readBootstrapAdminConfig({
      NODE_ENV: 'development',
      JIAN_AGENT_BOOTSTRAP_ADMIN: '0',
    });
    expect(config.enabled).toBe(false);
  });

  it('respects JIAN_AGENT_BOOTSTRAP_ADMIN=true to force enable in production', () => {
    const config = readBootstrapAdminConfig({
      NODE_ENV: 'production',
      JIAN_AGENT_BOOTSTRAP_ADMIN: 'true',
      JIAN_AGENT_BOOTSTRAP_ADMIN_PASSWORD: 'pw',
    });
    expect(config.enabled).toBe(true);
  });

  it('respects custom username from JIAN_AGENT_BOOTSTRAP_ADMIN_USERNAME', () => {
    const config = readBootstrapAdminConfig({
      JIAN_AGENT_BOOTSTRAP_ADMIN_USERNAME: 'superuser',
    });
    expect(config.username).toBe('superuser');
  });

  it('trims whitespace from custom username', () => {
    const config = readBootstrapAdminConfig({
      JIAN_AGENT_BOOTSTRAP_ADMIN_USERNAME: '  superuser  ',
    });
    expect(config.username).toBe('superuser');
  });

  it('uses default username "admin" when JIAN_AGENT_BOOTSTRAP_ADMIN_USERNAME is absent', () => {
    const config = readBootstrapAdminConfig({});
    expect(config.username).toBe('admin');
  });
});

// ── AuthService.verifyToken edge cases ───────────────────────────────────────

describe('AuthService.verifyToken', () => {
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

  it('throws UnauthorizedException for an expired token', () => {
    const expired = jwt.sign(
      { sub: 'user-1', username: 'alice', role: 0 },
      'jian-agent-dev-secret-do-not-use-in-production',
      { expiresIn: -1 },
    );
    expect(() => service.verifyToken(expired)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a malformed token', () => {
    expect(() => service.verifyToken('this.is.not.a.jwt')).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an empty string token', () => {
    expect(() => service.verifyToken('')).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a token signed with a different secret', () => {
    const wrongSecret = jwt.sign(
      { sub: 'user-1', username: 'alice', role: 0 },
      'completely-different-secret',
    );
    expect(() => service.verifyToken(wrongSecret)).toThrow(UnauthorizedException);
  });
});

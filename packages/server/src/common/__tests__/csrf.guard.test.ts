import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../network-config.js', () => ({
  readCorsConfig: () => ({
    origins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
}));

import { CsrfGuard } from '../csrf.guard.js';

function buildCtx(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard();
  });

  it('allows GET requests regardless of origin', () => {
    const ctx = buildCtx({
      method: 'GET',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows HEAD requests regardless of origin', () => {
    const ctx = buildCtx({
      method: 'HEAD',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows OPTIONS requests regardless of origin', () => {
    const ctx = buildCtx({
      method: 'OPTIONS',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows POST with a whitelisted origin', () => {
    const ctx = buildCtx({
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows PUT with a whitelisted origin', () => {
    const ctx = buildCtx({
      method: 'PUT',
      headers: { origin: 'http://127.0.0.1:5173' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows DELETE with no origin header (same-origin)', () => {
    const ctx = buildCtx({
      method: 'DELETE',
      headers: {},
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects POST with a disallowed origin', () => {
    const ctx = buildCtx({
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects PUT with a disallowed origin', () => {
    const ctx = buildCtx({
      method: 'PUT',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects PATCH with a disallowed origin', () => {
    const ctx = buildCtx({
      method: 'PATCH',
      headers: { origin: 'http://attacker.io' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects DELETE with a disallowed origin', () => {
    const ctx = buildCtx({
      method: 'DELETE',
      headers: { origin: 'http://attacker.io' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('CsrfGuard (no origins configured)', () => {
  it('allows any origin when allowedOrigins is empty', async () => {
    vi.resetModules();
    vi.doMock('../network-config.js', () => ({
      readCorsConfig: () => ({ origins: [] }),
    }));

    const { CsrfGuard: EmptyGuard } = await import('../csrf.guard.js');
    const guard = new EmptyGuard();

    const ctx = buildCtx({
      method: 'POST',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { TenantScopeGuard } from '../tenant-scope.guard.js';

function buildCtx(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any;
}

describe('TenantScopeGuard', () => {
  it('injects tenantId into body/query when absent', () => {
    const guard = new TenantScopeGuard();
    const req = {
      headers: { 'x-tenant-id': 'tenant-a' },
      body: {},
      query: {},
      method: 'POST',
    };

    const ok = guard.canActivate(buildCtx(req));
    expect(ok).toBe(true);
    expect(req.body.tenantId).toBe('tenant-a');
    expect(req.query.tenantId).toBe('tenant-a');
  });

  it('throws on tenant mismatch', () => {
    const guard = new TenantScopeGuard();
    const req = {
      headers: { 'x-tenant-id': 'tenant-a' },
      body: { tenantId: 'tenant-b' },
      query: {},
      method: 'POST',
    };

    expect(() => guard.canActivate(buildCtx(req))).toThrow();
  });
});

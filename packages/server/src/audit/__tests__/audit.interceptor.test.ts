import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../audit.service.js';
import { AUDITABLE_KEY } from '../auditable.decorator.js';

describe('AuditService', () => {
  it('should construct and have a record method', () => {
    const mockStore = { create: vi.fn().mockResolvedValue({ id: '1' }) };
    const service = new AuditService(mockStore as any);
    expect(typeof service.record).toBe('function');
  });

  it('should write an audit record via store', async () => {
    const mockStore = { create: vi.fn().mockResolvedValue({ id: '1' }) };
    const service = new AuditService(mockStore as any);

    await service.record({
      userId: 'u1',
      username: 'admin',
      operation: 'server.start',
      target: 'config-1',
      params: '{}',
      success: true,
      ip: '127.0.0.1',
    });

    expect(mockStore.create).toHaveBeenCalledOnce();
    const arg = mockStore.create.mock.calls[0][0];
    expect(arg.operation).toBe('server.start');
    expect(arg.userId).toBe('u1');
    expect(arg.timestamp).toBeDefined();
  });
});

describe('AUDITABLE_KEY', () => {
  it('should be a valid symbol or string', () => {
    expect(AUDITABLE_KEY).toBeDefined();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import { RequestContextInterceptor } from '../request-context.interceptor.js';

describe('RequestContextInterceptor', () => {
  it('generates request metadata and applies response headers', async () => {
    const interceptor = new RequestContextInterceptor();
    const request: Record<string, unknown> = { headers: {} };
    const response = { header: vi.fn() };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context as any, {
        handle: () => of({ ok: true }),
      } as any),
    );

    expect(result).toEqual({ ok: true });
    expect(typeof request.requestId).toBe('string');
    expect(request.traceId).toBe(request.requestId);
    expect(response.header).toHaveBeenCalledWith('x-request-id', request.requestId);
    expect(response.header).toHaveBeenCalledWith('x-trace-id', request.traceId);
  });

  it('reuses inbound request metadata when provided', async () => {
    const interceptor = new RequestContextInterceptor();
    const request: Record<string, unknown> = {
      headers: {
        'x-request-id': 'req-123',
        'x-trace-id': 'trace-123',
      },
    };
    const response = { header: vi.fn() };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    await firstValueFrom(
      interceptor.intercept(context as any, {
        handle: () => of({ ok: true }),
      } as any),
    );

    expect(request.requestId).toBe('req-123');
    expect(request.traceId).toBe('trace-123');
  });
});

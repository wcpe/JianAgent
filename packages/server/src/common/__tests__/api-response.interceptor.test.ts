import { describe, it, expect } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import { ApiResponseInterceptor } from '../api-response.interceptor.js';

describe('ApiResponseInterceptor', () => {
  it('enriches success envelopes with request metadata', async () => {
    const interceptor = new ApiResponseInterceptor();
    const request = { requestId: 'req-1', traceId: 'trace-1' };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context as any, {
        handle: () => of({ success: true, data: { id: '1' } }),
      } as any),
    );

    expect(result).toMatchObject({
      success: true,
      data: { id: '1' },
      requestId: 'req-1',
      traceId: 'trace-1',
      meta: {
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
  });

  it('keeps raw DTO responses unchanged', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'req-1', traceId: 'trace-1' }),
      }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context as any, {
        handle: () => of({ id: 'raw-1', name: 'raw' }),
      } as any),
    );

    expect(result).toEqual({ id: 'raw-1', name: 'raw' });
  });

  it('adds message and metadata to legacy success-false payloads', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'req-2', traceId: 'trace-2' }),
      }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context as any, {
        handle: () => of({ success: false, error: 'Session not found' }),
      } as any),
    );

    expect(result).toMatchObject({
      success: false,
      error: 'Session not found',
      message: 'Session not found',
      requestId: 'req-2',
      traceId: 'trace-2',
    });
  });
});

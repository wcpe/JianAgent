/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../client.js';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn((k: string) => mockStorage[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { mockStorage[k] = v; }),
    removeItem: vi.fn((k: string) => { delete mockStorage[k]; }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const h = new Map(Object.entries(headers ?? {}));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

describe('apiFetch', () => {
  it('sends GET with auth header when token exists', async () => {
    mockStorage['token'] = 'my-token';
    mockFetch(200, { ok: true });

    await apiFetch('/test');

    const [url, opts] = (fetch as any).mock.calls[0]!;
    expect(url).toBe('/api/v1/test');
    expect(opts.headers['Authorization']).toBe('Bearer my-token');
  });

  it('sends GET without auth header when no token', async () => {
    mockFetch(200, { ok: true });

    await apiFetch('/test');

    const [, opts] = (fetch as any).mock.calls[0]!;
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('sets Content-Type for body requests', async () => {
    mockFetch(200, { ok: true });

    await apiFetch('/test', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, opts] = (fetch as any).mock.calls[0]!;
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('parses JSON response', async () => {
    mockFetch(200, { data: 'hello' });

    const result = await apiFetch<{ data: string }>('/test');
    expect(result).toEqual({ data: 'hello' });
  });

  it('returns undefined for 204 response', async () => {
    mockFetch(204, '', { 'content-length': '0' });

    const result = await apiFetch('/test');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch(500, 'Internal Server Error');

    await expect(apiFetch('/test')).rejects.toThrow(ApiError);
    try {
      await apiFetch('/test');
    } catch (e) {
      expect((e as ApiError).status).toBe(500);
    }
  });

  it('parses structured error responses', async () => {
    mockFetch(400, { code: 'FILE_PATH_OUT_OF_BOUNDS', message: '路径超出允许范围' });

    try {
      await apiFetch('/test');
      throw new Error('expected apiFetch to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).message).toBe('FILE_PATH_OUT_OF_BOUNDS: 路径超出允许范围');
    }
  });

  it('parses nested structured error envelopes and request metadata', async () => {
    mockFetch(409, {
      success: false,
      error: {
        code: 'CONFLICT',
        message: '资源冲突',
        details: { resourceId: 'srv-1' },
      },
      meta: {
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });

    try {
      await apiFetch('/test');
      throw new Error('expected apiFetch to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(409);
      expect((e as ApiError).message).toBe('CONFLICT: 资源冲突');
      expect((e as ApiError).requestId).toBe('req-1');
      expect((e as ApiError).traceId).toBe('trace-1');
      expect((e as ApiError).details).toEqual({ resourceId: 'srv-1' });
    }
  });
});

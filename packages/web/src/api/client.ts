const BASE_URL = '/api/v1';

interface StructuredApiErrorBody {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly error?: unknown;
  readonly details?: unknown;
  readonly requestId?: unknown;
  readonly traceId?: unknown;
  readonly meta?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly body?: string,
    public readonly requestId?: string,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorBody(body: string): {
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  traceId?: string;
} {
  const trimmed = body.trim();
  if (!trimmed) {
    return { message: '请求失败' };
  }

  try {
    const parsed = JSON.parse(trimmed) as StructuredApiErrorBody;
    const nestedError = parsed.error && typeof parsed.error === 'object' && !Array.isArray(parsed.error)
      ? parsed.error as Record<string, unknown>
      : undefined;
    const meta = parsed.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)
      ? parsed.meta as Record<string, unknown>
      : undefined;
    const code = readString(nestedError?.code) ?? readString(parsed.code);
    const rawMessage = Array.isArray(nestedError?.message)
      ? nestedError.message.filter((item): item is string => typeof item === 'string').join('；')
      : nestedError?.message ?? (Array.isArray(parsed.message)
        ? parsed.message.filter((item) => typeof item === 'string').join('；')
        : parsed.message);
    const readableMessage = typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage.trim()
      : typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : trimmed;

    return {
      message: code ? `${code}: ${readableMessage}` : readableMessage,
      code,
      details: nestedError?.details ?? parsed.details,
      requestId: readString(parsed.requestId) ?? readString(meta?.requestId),
      traceId: readString(parsed.traceId) ?? readString(meta?.traceId),
    };
  } catch {
    return { message: trimmed };
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('token');
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.body) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      const isLoginEndpoint = path === '/auth/login';
      if (!isLoginEndpoint) {
        sessionStorage.removeItem('token');
        window.location.href = '/login';
        return new Promise<T>(() => {});
      }
    }
    const body = await response.text();
    const parsed = parseErrorBody(body);
    throw new ApiError(
      response.status,
      parsed.message,
      parsed.code,
      parsed.details,
      body,
      parsed.requestId ?? response.headers.get('x-request-id') ?? undefined,
      parsed.traceId ?? response.headers.get('x-trace-id') ?? undefined,
    );
  }

  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

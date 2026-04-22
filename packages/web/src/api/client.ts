const BASE_URL = '/api';

interface StructuredApiErrorBody {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly error?: unknown;
  readonly details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorBody(body: string): { message: string; code?: string; details?: unknown } {
  const trimmed = body.trim();
  if (!trimmed) {
    return { message: '请求失败' };
  }

  try {
    const parsed = JSON.parse(trimmed) as StructuredApiErrorBody;
    const code = typeof parsed.code === 'string' && parsed.code.trim() ? parsed.code.trim() : undefined;
    const rawMessage = Array.isArray(parsed.message)
      ? parsed.message.filter((item) => typeof item === 'string').join('；')
      : parsed.message;
    const readableMessage = typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage.trim()
      : typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : trimmed;

    return {
      message: code ? `${code}: ${readableMessage}` : readableMessage,
      code,
      details: parsed.details,
    };
  } catch {
    return { message: trimmed };
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
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
        localStorage.removeItem('token');
        window.location.href = '/login';
        return new Promise<T>(() => {});
      }
    }
    const body = await response.text();
    const parsed = parseErrorBody(body);
    throw new ApiError(response.status, parsed.message, parsed.code, parsed.details, body);
  }

  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}

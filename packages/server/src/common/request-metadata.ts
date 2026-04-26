import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';

export interface RequestMetadata {
  readonly requestId: string;
  readonly traceId: string;
}

interface RequestLike {
  headers?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
}

export function resolveRequestMetadata(request: RequestLike): RequestMetadata {
  const requestId = request.requestId ?? readHeaderValue(request.headers?.[REQUEST_ID_HEADER]) ?? randomUUID();
  const traceId = request.traceId ?? readHeaderValue(request.headers?.[TRACE_ID_HEADER]) ?? requestId;

  request.requestId = requestId;
  request.traceId = traceId;

  return { requestId, traceId };
}

export function applyRequestMetadataHeaders(response: unknown, metadata: RequestMetadata): void {
  setHeader(response, REQUEST_ID_HEADER, metadata.requestId);
  setHeader(response, TRACE_ID_HEADER, metadata.traceId);
}

function readHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) {
        return entry.trim();
      }
    }
    return undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function setHeader(target: unknown, name: string, value: string): void {
  if (!target || typeof target !== 'object') {
    return;
  }

  if ('header' in target && typeof (target as { header?: unknown }).header === 'function') {
    (target as { header: (headerName: string, headerValue: string) => unknown }).header(name, value);
    return;
  }

  if ('setHeader' in target && typeof (target as { setHeader?: unknown }).setHeader === 'function') {
    (target as { setHeader: (headerName: string, headerValue: string) => unknown }).setHeader(name, value);
  }
}

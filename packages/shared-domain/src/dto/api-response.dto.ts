export interface ApiResponseMeta {
  readonly requestId?: string;
  readonly traceId?: string;
  readonly timestamp?: number;
  readonly statusCode?: number;
}

export interface ApiErrorDetail {
  readonly code?: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiResponseEnvelope<T = unknown> {
  readonly success: true;
  readonly data: T;
  readonly code?: string;
  readonly message?: string;
  readonly details?: unknown;
  readonly meta?: ApiResponseMeta;
  readonly requestId?: string;
  readonly traceId?: string;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: ApiErrorDetail | string;
  readonly code?: string;
  readonly message: string;
  readonly details?: unknown;
  readonly meta?: ApiResponseMeta;
  readonly requestId?: string;
  readonly traceId?: string;
}

export type ApiResponsePayload<T = unknown> = ApiResponseEnvelope<T> | ApiErrorEnvelope;

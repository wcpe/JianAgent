import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import type { ApiResponseMeta } from '@jian-agent/shared-domain';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const requestId = typeof request.requestId === 'string' ? request.requestId : undefined;
    const traceId = typeof request.traceId === 'string' ? request.traceId : undefined;

    return next.handle().pipe(
      map((value) => enrichApiResponse(value, requestId, traceId)),
    );
  }
}

function enrichApiResponse(
  value: unknown,
  requestId?: string,
  traceId?: string,
): unknown {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    return value;
  }

  const existingMeta = isRecord(value.meta) ? (value.meta as ApiResponseMeta) : undefined;
  const meta: ApiResponseMeta = {
    ...existingMeta,
    requestId: requestId ?? existingMeta?.requestId,
    traceId: traceId ?? existingMeta?.traceId,
    timestamp: existingMeta?.timestamp ?? Date.now(),
    statusCode: existingMeta?.statusCode,
  };

  const enriched: Record<string, unknown> = {
    ...value,
    meta,
    requestId: value.requestId ?? requestId,
    traceId: value.traceId ?? traceId,
  };

  if (value.success === false && typeof enriched.message !== 'string') {
    const legacyError = typeof enriched.error === 'string'
      ? enriched.error
      : isRecord(enriched.error) && typeof enriched.error.message === 'string'
        ? enriched.error.message
        : 'Request failed';
    enriched.message = legacyError;
  }

  return enriched;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

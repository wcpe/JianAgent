import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { applyRequestMetadataHeaders, resolveRequestMetadata } from './request-metadata.js';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Record<string, unknown>>();
    const response = http.getResponse<unknown>();
    const metadata = resolveRequestMetadata(request);

    applyRequestMetadataHeaders(response, metadata);

    return next.handle();
  }
}

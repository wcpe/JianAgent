import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorDetail, ApiErrorEnvelope, ApiResponseMeta } from '@jian-agent/shared-domain';
import { applyRequestMetadataHeaders, resolveRequestMetadata } from './request-metadata.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Record<string, unknown>>();
    const response = http.getResponse<{
      status: (statusCode: number) => { send: (body: unknown) => unknown };
    } | {
      code?: (statusCode: number) => { send: (body: unknown) => unknown };
      send?: (body: unknown) => unknown;
      status?: (statusCode: number) => { send: (body: unknown) => unknown };
    }>();
    const metadata = resolveRequestMetadata(request);
    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const normalized = normalizeException(exception, statusCode);
    const meta: ApiResponseMeta = {
      requestId: metadata.requestId,
      traceId: metadata.traceId,
      statusCode,
      timestamp: Date.now(),
    };
    const body: ApiErrorEnvelope = {
      success: false,
      error: normalized,
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      meta,
      requestId: metadata.requestId,
      traceId: metadata.traceId,
    };

    applyRequestMetadataHeaders(response, metadata);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const message = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`Unhandled exception (${metadata.requestId}): ${message}`);
    }

    if (typeof (response as { status?: unknown }).status === 'function') {
      (response as { status: (statusCode: number) => { send: (body: unknown) => unknown } })
        .status(statusCode)
        .send(body);
      return;
    }

    if (typeof (response as { code?: unknown }).code === 'function') {
      (response as { code: (statusCode: number) => { send: (body: unknown) => unknown } })
        .code(statusCode)
        .send(body);
      return;
    }

    if (typeof (response as { send?: unknown }).send === 'function') {
      (response as { send: (body: unknown) => unknown }).send(body);
      return;
    }

    throw exception;
  }
}

function normalizeException(exception: unknown, statusCode: number): ApiErrorDetail {
  const fallbackCode = codeFromStatus(statusCode);
  const fallbackMessage = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
    ? 'Internal server error'
    : 'Request failed';

  if (exception instanceof HttpException) {
    return normalizeHttpException(exception, fallbackCode, fallbackMessage);
  }

  if (exception instanceof Error) {
    const isProduction = process.env['NODE_ENV'] === 'production';
    return {
      code: fallbackCode,
      message: isProduction ? fallbackMessage : (exception.message || fallbackMessage),
    };
  }

  const isProduction = process.env['NODE_ENV'] === 'production';
  return {
    code: fallbackCode,
    message: fallbackMessage,
    ...(isProduction ? {} : { details: exception }),
  };
}

function normalizeHttpException(
  exception: HttpException,
  fallbackCode: string,
  fallbackMessage: string,
): ApiErrorDetail {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return {
      code: fallbackCode,
      message: response || fallbackMessage,
    };
  }

  if (!isRecord(response)) {
    return {
      code: fallbackCode,
      message: fallbackMessage,
      details: response,
    };
  }

  const nestedError = isRecord(response.error) ? response.error : undefined;
  const code = readString(nestedError?.code) ?? readString(response.code) ?? fallbackCode;
  const message = readMessage(nestedError?.message)
    ?? readMessage(response.message)
    ?? readString(response.error)
    ?? fallbackMessage;
  const details = nestedError?.details ?? response.details ?? (Array.isArray(response.message) ? response.message : undefined);

  return { code, message, details };
}

function codeFromStatus(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_FAILED';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    case HttpStatus.GATEWAY_TIMEOUT:
      return 'GATEWAY_TIMEOUT';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

function readMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const messages = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return messages.length > 0 ? messages.join('；') : undefined;
  }

  return readString(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError } from 'rxjs';
import { AUDITABLE_KEY } from './auditable.decorator.js';
import { AuditService } from './audit.service.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const operation = this.reflector.get<string | undefined>(AUDITABLE_KEY, context.getHandler());
    if (!operation) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user ?? { sub: 'anonymous', username: 'anonymous' };
    const ip = request.ip ?? request.headers['x-forwarded-for'] ?? '';
    const target = request.params?.id ?? '';
    const params = JSON.stringify(request.body ?? {}).slice(0, 1000);

    return next.handle().pipe(
      tap(() => {
        this.auditService.record({ userId: user.sub, username: user.username, operation, target, params, success: true, ip });
      }),
      catchError((err) => {
        this.auditService.record({ userId: user.sub, username: user.username, operation, target, params, success: false, ip });
        throw err;
      }),
    );
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { readCorsConfig } from './network-config.js';

/**
 * Origin-based CSRF guard for state-changing HTTP methods.
 *
 * Although the application already uses JWT Bearer tokens (not cookie-based
 * sessions) and has a CORS whitelist, this guard adds defense-in-depth by
 * rejecting cross-origin POST / PUT / PATCH / DELETE requests whose Origin
 * header does not match the configured allowed origins.
 *
 * Safe methods (GET, HEAD, OPTIONS) are always allowed.
 * Same-origin requests (no Origin header) are always allowed.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor() {
    const { origins } = readCorsConfig();
    this.allowedOrigins = new Set(origins);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers?: Record<string, string | undefined>;
    }>();

    const method = request.method?.toUpperCase();

    // Safe methods never carry CSRF risk.
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // When no CORS origins are configured the server runs in same-origin
    // mode (production without explicit whitelist) -- skip the check.
    if (this.allowedOrigins.size === 0) {
      return true;
    }

    const origin = request.headers?.['origin'];

    // Browsers omit the Origin header for same-origin requests.  Allowing
    // these avoids blocking legitimate API calls from the same host.
    if (!origin) {
      return true;
    }

    if (this.allowedOrigins.has(origin)) {
      return true;
    }

    throw new ForbiddenException('Invalid origin');
  }
}

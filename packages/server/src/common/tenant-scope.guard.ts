import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

function readTenantId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value;
  return undefined;
}

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const headerTenant = readTenantId(req.headers?.['x-tenant-id']);

    if (!headerTenant) {
      throw new ForbiddenException('Missing tenant scope header: x-tenant-id');
    }

    const bodyTenant = readTenantId(req.body?.tenantId);
    const queryTenant = readTenantId(req.query?.tenantId);
    const inputTenant = bodyTenant ?? queryTenant;

    if (inputTenant && inputTenant !== headerTenant) {
      throw new ForbiddenException('Tenant scope mismatch');
    }

    if (req.body && !bodyTenant && req.method !== 'GET') {
      req.body.tenantId = headerTenant;
    }

    if (req.query && !queryTenant) {
      req.query.tenantId = headerTenant;
    }

    req.tenantId = headerTenant;
    return true;
  }
}

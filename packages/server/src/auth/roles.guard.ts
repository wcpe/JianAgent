import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleLevel } from '@jian-agent/shared-domain';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel = this.reflector.getAllAndOverride<RoleLevel | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredLevel === undefined) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

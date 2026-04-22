import { SetMetadata } from '@nestjs/common';
import type { RoleLevel } from '@jian-agent/shared-domain';

export const ROLES_KEY = 'roles';
export const Roles = (minLevel: RoleLevel) => SetMetadata(ROLES_KEY, minLevel);

import { Injectable } from '@nestjs/common';

export enum PtyPermission {
  VIEW = 0,
  SEND_COMMAND = 1,
  SEND_DANGER = 2,
  FORCE_INTERRUPT = 3,
}

const ROLE_PERMISSION_MAP: Readonly<Record<number, PtyPermission>> = {
  0: PtyPermission.VIEW,           // VIEWER
  1: PtyPermission.SEND_COMMAND,   // OPERATOR
  2: PtyPermission.SEND_COMMAND,   // TESTER
  3: PtyPermission.SEND_DANGER,    // TERMINAL
  4: PtyPermission.FORCE_INTERRUPT, // DANGER
  5: PtyPermission.FORCE_INTERRUPT, // ADMIN
} as const;

const DANGER_COMMANDS: readonly string[] = [
  'stop',
  'restart',
  'op ',
  'deop ',
  'ban ',
  'whitelist ',
  'save-off',
  'kill',
] as const;

export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

@Injectable()
export class PtyPermissionService {
  getPermission(roleLevel: number): PtyPermission {
    return ROLE_PERMISSION_MAP[roleLevel] ?? PtyPermission.VIEW;
  }

  canExecute(roleLevel: number, command: string): PermissionCheckResult {
    const perm = this.getPermission(roleLevel);

    if (perm === PtyPermission.VIEW) {
      return { allowed: false, reason: 'VIEWER cannot send commands' };
    }

    const trimmed = command.trim().toLowerCase();
    const isDanger = DANGER_COMMANDS.some((d) => trimmed.startsWith(d));

    if (isDanger && perm < PtyPermission.SEND_DANGER) {
      return { allowed: false, reason: `Command "${trimmed}" requires SEND_DANGER permission` };
    }

    return { allowed: true };
  }

  canForceInterrupt(roleLevel: number): boolean {
    return this.getPermission(roleLevel) >= PtyPermission.FORCE_INTERRUPT;
  }
}

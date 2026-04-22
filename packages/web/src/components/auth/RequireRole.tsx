import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/auth.store.js';

interface RequireRoleProps {
  readonly level: number;
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function RequireRole({ level, fallback, children }: RequireRoleProps) {
  const role = useAuthStore((s) => s.user?.role ?? 0);
  if (role < level) return <>{fallback ?? null}</>;
  return <>{children}</>;
}

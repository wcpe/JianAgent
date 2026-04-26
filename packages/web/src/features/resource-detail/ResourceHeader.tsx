import { Link } from 'react-router-dom';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';
import { ResourceCompatibilityBadge } from './ResourceCompatibilityBadge';

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-200',
  degraded: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-200',
  critical: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-200',
  unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: '健康',
  degraded: '降级',
  critical: '严重',
  unknown: '未知',
};

export interface ResourceHeaderProps {
  detail: ResourceDetailDto;
  backTo?: string;
  backLabel?: string;
}

export function ResourceHeader({ detail, backTo = '/servers', backLabel = '返回列表' }: ResourceHeaderProps) {
  const { status } = detail;
  const healthClass = HEALTH_COLORS[status.health] ?? HEALTH_COLORS.unknown;
  const healthLabel = HEALTH_LABELS[status.health] ?? status.health;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-900 text-white shrink-0">
      <div className="flex items-center gap-4">
        <Link
          to={backTo}
          className="text-gray-400 hover:text-white text-sm"
        >
          ← {backLabel}
        </Link>
        <div className="w-px h-5 bg-gray-600" />
        <div>
          <span className="font-semibold text-sm">{detail.name}</span>
          <span className="ml-2 text-xs text-gray-400">{detail.kind}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status.version && (
          <span className="text-xs text-gray-400">v{status.version}</span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${healthClass}`}>
          {healthLabel}
        </span>
        <span className="text-xs text-gray-400">{status.state}</span>
        <ResourceCompatibilityBadge platformType={detail.kind} capabilities={detail.capabilities} />
      </div>
    </div>
  );
}

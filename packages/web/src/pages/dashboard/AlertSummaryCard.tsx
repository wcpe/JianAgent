import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboard.store.js';

const levelColors: Record<string, string> = {
  CRITICAL: 'bg-danger-600',
  WARNING: 'bg-warning-600',
  INFO: 'bg-info-600',
};

const AlertSummaryCard: FC = () => {
  const alertStats = useDashboardStore((s) => s.alertStats);

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">告警摘要</h3>

      <div className="flex gap-3 mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-700/50 px-2.5 py-0.5 text-xs font-medium text-danger-200">
          CRITICAL {alertStats.critical}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-700/50 px-2.5 py-0.5 text-xs font-medium text-warning-200">
          WARNING {alertStats.warning}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-info-700/50 px-2.5 py-0.5 text-xs font-medium text-info-200">
          INFO {alertStats.info}
        </span>
      </div>

      <ul className="space-y-2 text-sm">
        {alertStats.recentAlerts.slice(0, 5).map((alert, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className={`mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${levelColors[alert.level] ?? 'bg-gray-500'}`} />
            <span className="text-gray-300 truncate">{alert.message}</span>
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </li>
        ))}
        {alertStats.recentAlerts.length === 0 && (
          <li className="text-gray-500">暂无告警</li>
        )}
      </ul>

      <Link to="/alerts" className="mt-3 block text-center text-xs text-info-400 hover:text-info-200">
        查看全部 →
      </Link>
    </div>
  );
};

export default AlertSummaryCard;

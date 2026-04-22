import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboard.store.js';

const levelColors: Record<string, string> = {
  CRITICAL: 'bg-red-600',
  WARNING: 'bg-yellow-600',
  INFO: 'bg-blue-600',
};

const AlertSummaryCard: FC = () => {
  const alertStats = useDashboardStore((s) => s.alertStats);

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">告警摘要</h3>

      <div className="flex gap-3 mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-900/50 px-2.5 py-0.5 text-xs font-medium text-red-300">
          CRITICAL {alertStats.critical}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/50 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
          WARNING {alertStats.warning}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/50 px-2.5 py-0.5 text-xs font-medium text-blue-300">
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

      <Link to="/alerts" className="mt-3 block text-center text-xs text-blue-400 hover:text-blue-300">
        查看全部 →
      </Link>
    </div>
  );
};

export default AlertSummaryCard;

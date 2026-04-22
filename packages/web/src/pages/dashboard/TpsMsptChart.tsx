import { type FC } from 'react';
import TimeSeriesChart from '../../components/chart/TimeSeriesChart.js';
import { useDashboardStore } from '../../stores/dashboard.store.js';

const dataKeys = [
  { key: 'tps', color: '#22c55e', name: 'TPS', yAxisId: 'left' },
  { key: 'mspt', color: '#f59e0b', name: 'MSPT', yAxisId: 'right' },
] as const;

const TpsMsptChart: FC = () => {
  const metricHistory = useDashboardStore((s) => s.metricHistory);

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-2">TPS / MSPT 趋势</h3>
      <TimeSeriesChart
        data={metricHistory}
        dataKeys={[...dataKeys]}
        dualYAxis
        height={280}
      />
    </div>
  );
};

export default TpsMsptChart;

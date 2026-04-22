import { type FC } from 'react';
import TimeSeriesChart from '../../components/chart/TimeSeriesChart.js';
import { useDashboardStore } from '../../stores/dashboard.store.js';

const dataKeys = [
  { key: 'cpuUsage', color: '#3b82f6', name: 'CPU %', yAxisId: 'left' },
  { key: 'memoryUsageMb', color: '#8b5cf6', name: '内存 MB', yAxisId: 'right' },
] as const;

const ResourceChart: FC = () => {
  const metricHistory = useDashboardStore((s) => s.metricHistory);

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-2">CPU / 内存趋势</h3>
      <TimeSeriesChart
        data={metricHistory}
        dataKeys={[...dataKeys]}
        dualYAxis
        height={280}
      />
    </div>
  );
};

export default ResourceChart;

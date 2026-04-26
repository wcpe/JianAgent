import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { populationApi, type PopulationRecord } from '../../api/population.api.js';
import { useServerStore } from '../../stores/server.store.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { Users, RefreshCw, Trash2 } from 'lucide-react';
import { useDialogStore } from '../../stores/dialog.store.js';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1 小时',
  '6h': '6 小时',
  '24h': '24 小时',
  '7d': '7 天',
  '30d': '30 天',
};

const TOOLTIP_STYLE = { backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F3F4F6' };

const COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#06B6D4', '#F97316', '#EC4899'];

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface MergedPoint {
  readonly timestamp: string;
  readonly [serverName: string]: number | string;
}

function mergeByTimestamp(records: readonly PopulationRecord[]): MergedPoint[] {
  const byTime = new Map<string, Record<string, number | string>>();
  for (const r of records) {
    // Round to minute
    const ts = r.timestamp.slice(0, 16);
    if (!byTime.has(ts)) byTime.set(ts, { timestamp: ts });
    const point = byTime.get(ts)!;
    point[r.serverName] = r.onlinePlayers;
  }
  return [...byTime.values()]
    .sort((a, b) => (a.timestamp as string).localeCompare(b.timestamp as string)) as MergedPoint[];
}

export function PopulationPage() {
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const showToast = useDialogStore((s) => s.showToast);
  const [serverId, setServerId] = useState('__all__');
  const [range, setRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<readonly PopulationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - RANGE_MS[range]).toISOString();
      const limit = range === '30d' ? 4320 : range === '7d' ? 1440 : range === '24h' ? 1440 : 360;
      const result = await populationApi.getHistory({
        serverId: serverId === '__all__' ? undefined : serverId,
        startTime,
        endTime,
        limit,
      });
      setData(Array.isArray(result) ? result : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [serverId, range]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await populationApi.cleanup(retentionDays);
      await loadData();
      showToast(`已清理 ${retentionDays} 天前的数据`, 'success');
    } catch (err: any) {
      showToast(err.message ?? '清理失败', 'error');
    } finally {
      setCleaning(false);
    }
  }, [retentionDays, loadData, showToast]);

  const merged = mergeByTimestamp(data);
  const serverNames = [...new Set(data.map((r) => r.serverName))];

  // Stats
  const latestByServer = new Map<string, PopulationRecord>();
  for (const r of data) {
    const existing = latestByServer.get(r.serverId);
    if (!existing || r.timestamp > existing.timestamp) {
      latestByServer.set(r.serverId, r);
    }
  }
  const totalOnline = [...latestByServer.values()].reduce((sum, r) => sum + r.onlinePlayers, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <Users size={24} />
        在线人数统计
      </h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <StyledSelect
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          className="w-auto"
        >
          <option value="__all__">全部服务器</option>
          {servers.map((sv) => (
            <option key={sv.id} value={sv.id}>{sv.name}</option>
          ))}
        </StyledSelect>

        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(Object.keys(RANGE_MS) as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 dark:text-gray-400">保留</span>
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
            className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">天</span>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-danger-100 dark:bg-danger-700/30 text-danger-700 dark:text-danger-400 rounded hover:bg-danger-200 dark:hover:bg-danger-700/50 transition-colors disabled:opacity-50 active:scale-95"
          >
            <Trash2 size={12} />
            清理
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">当前总在线</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalOnline}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">监控服务器</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{latestByServer.size}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">数据点</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">时间范围</p>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{RANGE_LABELS[range]}</p>
        </div>
      </div>

      {data.length === 0 && !loading && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">
          暂无数据。系统会每分钟自动采集在线服务器的玩家人数。
        </p>
      )}

      {/* Chart */}
      {merged.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            在线玩家趋势
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={merged as any[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={range === '7d' || range === '30d' ? formatDateTime : formatTime}
                  tick={{ fontSize: 11 }}
                  stroke="#9CA3AF"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend />
                {serverNames.map((name, i) => (
                  <Area
                    key={name}
                    type="stepAfter"
                    dataKey={name}
                    name={name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={`${COLORS[i % COLORS.length]}20`}
                    strokeWidth={2}
                    stackId={serverNames.length > 1 ? undefined : '1'}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

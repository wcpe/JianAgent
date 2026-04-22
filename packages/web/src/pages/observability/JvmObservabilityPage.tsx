import { useEffect, useMemo, useState } from 'react';
import { metricsApi } from '../../api/metrics.api.js';
import { javaHelperApi } from '../../api/java-helper.api.js';
import { serverApi } from '../../api/server.api.js';
import type { MonitoringOverviewDto } from '@jian-agent/shared-domain';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function JvmObservabilityPage() {
  const [serverId, setServerId] = useState('');
  const [pid, setPid] = useState('');
  const [jmxLatest, setJmxLatest] = useState<any>(null);
  const [jmxHistory, setJmxHistory] = useState<any[]>([]);
  const [jfrTasks, setJfrTasks] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [overview, setOverview] = useState<MonitoringOverviewDto | null>(null);
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([]);
  const [javaProcesses, setJavaProcesses] = useState<Array<{ pid: number; command: string }>>([]);
  const [processLoading, setProcessLoading] = useState(false);
  const [historyIntervalSec, setHistoryIntervalSec] = useState(300);
  const [historyWindowHours, setHistoryWindowHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const canRun = useMemo(() => serverId.trim() !== '' && pid.trim() !== '', [serverId, pid]);
  const chartData = useMemo(() => {
    return jmxHistory.map((item) => ({
      time: new Date(item.bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      heapUsedMb: item.heapUsedMb == null ? null : Number(item.heapUsedMb.toFixed(2)),
      threadCount: item.threadCount == null ? null : Number(item.threadCount.toFixed(2)),
      sampleCount: item.sampleCount,
    }));
  }, [jmxHistory]);
  const activeThresholds = useMemo(() => {
    const schedule = schedules.find((item) => item.serverId === serverId);
    return {
      heapUsedThresholdMb:
        typeof schedule?.heapUsedThresholdMb === 'number' ? schedule.heapUsedThresholdMb : null,
      threadThreshold:
        typeof schedule?.threadThreshold === 'number' ? schedule.threadThreshold : null,
    };
  }, [schedules, serverId]);

  const safeFetch = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch((err) => {
      console.error('[JvmObservability] fetch error:', err);
      return fallback;
    });

  const refresh = async () => {
    if (!serverId.trim()) {
      setJmxLatest(null);
      setJmxHistory([]);
      setJfrTasks([]);
      setSchedules([]);
      setOverview(null);
      return;
    }
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - historyWindowHours * 3600_000);
    const [latest, history, tasks, schedulerList, overviewRes] = await Promise.all([
      safeFetch(metricsApi.getJmxLatest(serverId), null as any),
      safeFetch(
        metricsApi.getJmxHistoryAggregated({
          serverId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          intervalSec: historyIntervalSec,
          limit: 24,
        }),
        [] as any[],
      ),
      safeFetch(javaHelperApi.listJfrTasks(serverId), { data: [] } as any),
      safeFetch(metricsApi.listJmxSchedules(), [] as any[]),
      safeFetch(metricsApi.getOverview(serverId), null as any),
    ]);
    setJmxLatest(latest);
    setJmxHistory(history);
    setJfrTasks(tasks.data ?? []);
    setSchedules(schedulerList);
    setOverview(overviewRes);
  };

  useEffect(() => {
    void refresh();
  }, [serverId, historyIntervalSec, historyWindowHours]);

  useEffect(() => {
    serverApi.listServers()
      .then((items) => setServers(items.map((item) => ({ id: item.id, name: item.name }))))
      .catch(() => setServers([]));
  }, []);

  const refreshJavaProcesses = async () => {
    try {
      setProcessLoading(true);
      const result = await serverApi.listJavaProcesses();
      setJavaProcesses(result.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setJavaProcesses([]);
    } finally {
      setProcessLoading(false);
    }
  };

  useEffect(() => {
    void refreshJavaProcesses();
  }, []);

  const runWithState = async (fn: () => Promise<void>) => {
    try {
      setBusy(true);
      setMessage('');
      await fn();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const exportHistoryCsv = () => {
    if (jmxHistory.length === 0) {
      setMessage('当前无可导出的聚合数据');
      return;
    }
    const header = [
      'bucketStart',
      'bucketEnd',
      'sampleCount',
      'heapUsedMb',
      'heapCommittedMb',
      'heapMaxMb',
      'threadCount',
      'daemonThreadCount',
      'gcYoungCount',
      'gcFullCount',
      'gcYoungTimeMs',
      'gcFullTimeMs',
    ];
    const lines = jmxHistory.map((item) => [
      item.bucketStart,
      item.bucketEnd,
      item.sampleCount,
      item.heapUsedMb ?? '',
      item.heapCommittedMb ?? '',
      item.heapMaxMb ?? '',
      item.threadCount ?? '',
      item.daemonThreadCount ?? '',
      item.gcYoungCount ?? '',
      item.gcFullCount ?? '',
      item.gcYoungTimeMs ?? '',
      item.gcFullTimeMs ?? '',
    ]);
    const csv = [header, ...lines].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jmx-aggregated-${serverId}-${historyWindowHours}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('CSV 导出完成');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">JVM Observability</h1>

      <section className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">本机 JVM 进程</h2>
            <p className="text-sm text-gray-500">先从本机扫描 Java 进程，再选择一个目标进入观测。</p>
          </div>
          <button
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void refreshJavaProcesses()}
            disabled={processLoading}
          >
            {processLoading ? '扫描中...' : '刷新进程列表'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {javaProcesses.map((processInfo) => (
            <button
              key={processInfo.pid}
              type="button"
              onClick={() => {
                setPid(String(processInfo.pid));
                if (!serverId || serverId === 'default' || serverId.startsWith('local-jvm-')) {
                  setServerId(`local-jvm-${processInfo.pid}`);
                }
              }}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                pid === String(processInfo.pid)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm text-gray-900">PID {processInfo.pid}</div>
                  <div className="mt-1 text-xs text-gray-500 break-all">{processInfo.command}</div>
                </div>
                <span className="text-xs text-primary-600">选择观测</span>
              </div>
            </button>
          ))}
          {!processLoading && javaProcesses.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-sm text-gray-500">
              暂未扫描到本机 Java 进程。
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
        >
          <option value="">选择观测目标</option>
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))}
          {serverId.startsWith('local-jvm-') && !servers.some((server) => server.id === serverId) && (
            <option value={serverId}>{serverId}</option>
          )}
        </select>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2"
          placeholder="pid"
          value={pid}
          onChange={(e) => setPid(e.target.value)}
        />
        <button
          className="rounded-lg bg-primary-600 text-white px-3 py-2 disabled:opacity-50"
          disabled={!canRun || busy}
          onClick={() => runWithState(async () => {
            await metricsApi.collectJmx({ serverId, pid });
            setMessage('JMX 采集完成');
          })}
        >
          手动采集 JMX
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          className="rounded-lg bg-emerald-600 text-white px-3 py-2 disabled:opacity-50"
          disabled={!canRun || busy}
          onClick={() => runWithState(async () => {
            await javaHelperApi.startJfr({ serverId, pid, durationSec: 60, settings: 'profile' });
            setMessage('JFR 任务已启动');
          })}
        >
          启动 JFR 任务
        </button>

        <button
          className="rounded-lg bg-sky-700 text-white px-3 py-2 disabled:opacity-50"
          disabled={!canRun || busy}
          onClick={() => runWithState(async () => {
            await metricsApi.createJmxSchedule({
              serverId,
              pid,
              intervalSec: 30,
              heapUsedThresholdMb: 1024,
            });
            setMessage('JMX 定时采集已创建');
          })}
        >
          创建 JMX 定时采集(30s)
        </button>
      </div>

      {message && <div className="text-sm text-primary-700">{message}</div>}

      {overview && (
        <section className="rounded-xl border border-gray-200 p-4 bg-slate-950 text-white">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="font-medium mb-1">监控联动摘要</h2>
              <p className="text-sm text-white/65">{overview.state === 'healthy' ? 'JVM 与服务器指标均处于可接受范围。' : overview.state === 'degraded' ? '存在可关注的退化信号，建议结合服务器页查看。' : '当前存在高优先级风险信号。'}</p>
            </div>
            <div className="text-right text-sm">
              <div className="text-white/55">状态</div>
              <div className="font-semibold">{overview.state}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-white/10 p-3">
              <div className="text-white/50 text-xs">活跃规则</div>
              <div className="text-lg font-semibold">{overview.activeRuleCount}</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <div className="text-white/50 text-xs">JMX 任务</div>
              <div className="text-lg font-semibold">{overview.activeJmxScheduleCount}</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <div className="text-white/50 text-xs">活动告警</div>
              <div className="text-lg font-semibold">{overview.alertSummary.totalActive}</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <div className="text-white/50 text-xs">JVM 风险</div>
              <div className="text-lg font-semibold">{overview.signals.filter((item) => item.source === 'jmx').length}</div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-2">最新 JMX 快照</h2>
        <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">{JSON.stringify(jmxLatest, null, 2)}</pre>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">JMX 历史聚合</h2>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
              onClick={exportHistoryCsv}
            >
              导出 CSV
            </button>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={historyWindowHours}
              onChange={(e) => setHistoryWindowHours(Number(e.target.value))}
            >
              <option value={1}>最近 1 小时</option>
              <option value={6}>最近 6 小时</option>
              <option value={24}>最近 24 小时</option>
            </select>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={historyIntervalSec}
              onChange={(e) => setHistoryIntervalSec(Number(e.target.value))}
            >
              <option value={60}>1 分钟</option>
              <option value={300}>5 分钟</option>
              <option value={900}>15 分钟</option>
            </select>
          </div>
        </div>
        <div style={{ minHeight: 256 }} className="w-full mb-3 rounded border border-gray-100 bg-gray-50/60 p-2">
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis yAxisId="heap" tick={{ fontSize: 11 }} width={56} />
              <YAxis yAxisId="thread" orientation="right" tick={{ fontSize: 11 }} width={44} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => {
                  const metricName = typeof name === 'string' ? name : '';
                  const numeric = typeof value === 'number' ? value : null;
                  if (numeric == null) return ['-', metricName];
                  if (metricName === 'heapUsedMb') return [`${numeric.toFixed(1)} MB`, 'Heap Used'];
                  if (metricName === 'threadCount') return [`${numeric.toFixed(0)}`, 'Threads'];
                  return [String(numeric), metricName];
                }}
              />
              {activeThresholds.heapUsedThresholdMb != null && (
                <ReferenceLine
                  yAxisId="heap"
                  y={activeThresholds.heapUsedThresholdMb}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{ value: `Heap阈值 ${activeThresholds.heapUsedThresholdMb}MB`, fill: '#dc2626', fontSize: 11 }}
                />
              )}
              {activeThresholds.threadThreshold != null && (
                <ReferenceLine
                  yAxisId="thread"
                  y={activeThresholds.threadThreshold}
                  stroke="#b45309"
                  strokeDasharray="4 4"
                  label={{ value: `线程阈值 ${activeThresholds.threadThreshold}`, fill: '#b45309', fontSize: 11 }}
                />
              )}
              <Line yAxisId="heap" type="monotone" dataKey="heapUsedMb" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="thread" type="monotone" dataKey="threadCount" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-3">时间桶</th>
                <th className="py-1 pr-3">样本数</th>
                <th className="py-1 pr-3">Heap Used(MB)</th>
                <th className="py-1 pr-3">Threads</th>
                <th className="py-1 pr-3">GC Young</th>
                <th className="py-1 pr-3">GC Full</th>
              </tr>
            </thead>
            <tbody>
              {jmxHistory.map((item) => (
                <tr key={item.bucketStart} className="border-b last:border-b-0">
                  <td className="py-1 pr-3">{new Date(item.bucketStart).toLocaleTimeString()}</td>
                  <td className="py-1 pr-3">{item.sampleCount}</td>
                  <td className="py-1 pr-3">{item.heapUsedMb == null ? '-' : item.heapUsedMb.toFixed(1)}</td>
                  <td className="py-1 pr-3">{item.threadCount == null ? '-' : item.threadCount.toFixed(0)}</td>
                  <td className="py-1 pr-3">{item.gcYoungCount == null ? '-' : item.gcYoungCount.toFixed(1)}</td>
                  <td className="py-1 pr-3">{item.gcFullCount == null ? '-' : item.gcFullCount.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {jmxHistory.length === 0 && <div className="text-sm text-gray-500 py-2">暂无聚合数据</div>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-2">JFR 任务</h2>
        <div className="space-y-2">
          {jfrTasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono">{task.id.slice(0, 8)}</span>
              <span>{task.status}</span>
              {task.status === 'running' && (
                <button
                  className="rounded bg-amber-600 text-white px-2 py-1"
                  onClick={() => runWithState(async () => {
                    await javaHelperApi.stopJfr(task.id);
                    setMessage('JFR 任务已停止');
                  })}
                >
                  停止
                </button>
              )}
              {task.status === 'completed' && (
                <button
                  className="rounded bg-gray-800 text-white px-2 py-1"
                  onClick={() => runWithState(async () => {
                    const blob = await javaHelperApi.downloadJfrStream(task.id);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${task.id}.jfr`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setMessage('JFR 文件已下载');
                  })}
                >
                  下载
                </button>
              )}
            </div>
          ))}
          {jfrTasks.length === 0 && <div className="text-sm text-gray-500">暂无任务</div>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-2">JMX 定时采集任务</h2>
        <div className="space-y-2">
          {schedules.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="font-mono">{item.id.slice(0, 8)}</span>
              <span>{item.serverId}</span>
              <span>{item.intervalSec}s</span>
              <button
                className="rounded bg-rose-600 text-white px-2 py-1"
                onClick={() => runWithState(async () => {
                  await metricsApi.removeJmxSchedule(item.id);
                  setMessage('定时任务已移除');
                })}
              >
                删除
              </button>
            </div>
          ))}
          {schedules.length === 0 && <div className="text-sm text-gray-500">暂无定时任务</div>}
        </div>
      </section>
    </div>
  );
}

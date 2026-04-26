import { type FC, useState, useCallback, useEffect } from 'react';
import { useReportStore } from '../../stores/report.store.js';
import { reportApi } from '../../api/report.api.js';
import { SessionSelector } from './SessionSelector.js';
import { TrendCompareChart } from './TrendCompareChart.js';
import type { SessionReportDto } from '@jian-agent/shared-domain';

const ReportPage: FC = () => {
  const { selectedSessionId, report, loading, error, selectSession } = useReportStore();
  const [tab, setTab] = useState<'overview' | 'phases' | 'compare'>('overview');

  const handleExport = useCallback(
    (format: 'html' | 'json') => {
      if (!selectedSessionId) return;
      const url = reportApi.exportReportUrl(selectedSessionId, format);
      window.open(url, '_blank');
    },
    [selectedSessionId],
  );

  return (
    <div className="flex h-full gap-3 p-3">
      {/* Sidebar: session list */}
      <div className="w-72 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl overflow-y-auto p-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">会话列表</h2>
        <SessionSelector onSelect={selectSession} selectedId={selectedSessionId} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl">
        {!selectedSessionId && (
          <p className="text-gray-500 dark:text-gray-400">请从左侧选择一个会话查看报告</p>
        )}

        {loading && <p className="text-zinc-400">加载中...</p>}
        {error && <p className="text-danger-400">{error}</p>}

        {report && (
          <>
            {/* Export buttons */}
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-bold text-zinc-100 flex-1">
                会话报告: {report.sessionId.slice(0, 8)}
              </h1>
              <button
                onClick={() => handleExport('html')}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
              >
                导出 HTML
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-1.5 rounded bg-zinc-600 hover:bg-zinc-500 text-white text-sm"
              >
                导出 JSON
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-zinc-700">
              {(['overview', 'phases', 'compare'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm ${
                    tab === t
                      ? 'border-b-2 border-blue-500 text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t === 'overview' ? '概览' : t === 'phases' ? '阶段' : '对比'}
                </button>
              ))}
            </div>

            {tab === 'overview' && <OverviewTab report={report} />}
            {tab === 'phases' && <PhasesTab report={report} />}
            {tab === 'compare' && <CompareTab />}
          </>
        )}
      </div>
    </div>
  );
};

const OverviewTab: FC<{ readonly report: SessionReportDto }> = ({ report }) => (
  <div className="space-y-6">
    {/* Stats grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="持续时间" value={`${(report.durationMs / 1000 / 60).toFixed(1)}分`} />
      <StatCard label="Bot 峰值" value={String(report.botStats.peakOnline)} />
      <StatCard label="平均 TPS" value={report.serverPerf.avgTps.toFixed(1)} />
      <StatCard label="告警数" value={String(report.alerts.total)} />
    </div>

    {/* Server perf table */}
    <div className="bg-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">服务器性能</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-400 border-b border-zinc-700">
            <th className="text-left py-2">指标</th>
            <th className="text-left py-2">平均值</th>
            <th className="text-left py-2">极值</th>
          </tr>
        </thead>
        <tbody className="text-zinc-200">
          <tr><td className="py-1">TPS</td><td>{report.serverPerf.avgTps}</td><td>{report.serverPerf.minTps} (最低)</td></tr>
          <tr><td className="py-1">MSPT</td><td>{report.serverPerf.avgMspt}ms</td><td>{report.serverPerf.maxMspt}ms (峰值)</td></tr>
          <tr><td className="py-1">CPU</td><td>{report.serverPerf.avgCpuPercent}%</td><td>{report.serverPerf.peakCpuPercent}% (峰值)</td></tr>
          <tr><td className="py-1">内存</td><td>{report.serverPerf.avgMemoryMb}MB</td><td>{report.serverPerf.peakMemoryMb}MB (峰值)</td></tr>
        </tbody>
      </table>
    </div>

    {/* Conclusions */}
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-300">自动总结</h3>
      {report.conclusions.map((c, i) => (
        <div key={i} className="bg-blue-900/20 border-l-4 border-blue-500 px-4 py-3 rounded text-sm text-zinc-200">
          {c}
        </div>
      ))}
    </div>
  </div>
);

const PhasesTab: FC<{ readonly report: SessionReportDto }> = ({ report }) => {
  const totalDuration = report.durationMs || 1;

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">阶段时间线</h3>
        <div className="space-y-2">
          {report.phases.map((phase) => {
            const offset = ((phase.startTime - report.startTime) / totalDuration) * 100;
            const width = Math.max(((phase.endTime - phase.startTime) / totalDuration) * 100, 2);
            const color =
              phase.status === 'completed' ? 'bg-success-500' :
              phase.status === 'failed' ? 'bg-danger-500' : 'bg-zinc-500';

            return (
              <div key={phase.phaseId} className="flex items-center gap-3">
                <span className="w-32 text-xs text-zinc-400 truncate">{phase.phaseName}</span>
                <div className="flex-1 h-6 bg-zinc-700 rounded relative">
                  <div
                    className={`absolute top-0 h-full rounded ${color}`}
                    style={{ left: `${offset}%`, width: `${width}%` }}
                    title={`${phase.phaseName}: ${phase.status}`}
                  />
                </div>
                <span className="w-20 text-xs text-zinc-400">{phase.avgTps.toFixed(1)} TPS</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase details table */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">阶段详情</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400 border-b border-zinc-700">
              <th className="text-left py-2">阶段</th>
              <th className="text-left py-2">状态</th>
              <th className="text-left py-2">Bot 数</th>
              <th className="text-left py-2">平均 TPS</th>
              <th className="text-left py-2">平均 MSPT</th>
            </tr>
          </thead>
          <tbody className="text-zinc-200">
            {report.phases.map((p) => (
              <tr key={p.phaseId} className="border-b border-zinc-700/50">
                <td className="py-2">{p.phaseName}</td>
                <td className={`py-2 ${p.status === 'completed' ? 'text-success-400' : p.status === 'failed' ? 'text-danger-400' : 'text-zinc-500'}`}>
                  {p.status}
                </td>
                <td className="py-2">{p.botCount}</td>
                <td className="py-2">{p.avgTps.toFixed(1)}</td>
                <td className="py-2">{p.avgMspt.toFixed(1)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CompareTab: FC = () => {
  const { compareSessionIds } = useReportStore();

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">选择多个会话进行指标对比 (最多 5 个)</p>
      <SessionSelector
        onSelect={(id) => useReportStore.getState().addCompareSession(id)}
        selectedId={null}
        multi
      />
      {compareSessionIds.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {compareSessionIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-200"
              >
                {id.slice(0, 8)}
                <button
                  onClick={() => useReportStore.getState().removeCompareSession(id)}
                  className="text-zinc-400 hover:text-danger-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <TrendCompareChart sessionIds={compareSessionIds} metric="tps" yLabel="TPS" />
          <TrendCompareChart sessionIds={compareSessionIds} metric="mspt" yLabel="MSPT (ms)" />
        </div>
      )}
    </div>
  );
};

const StatCard: FC<{ readonly label: string; readonly value: string }> = ({ label, value }) => (
  <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4 text-center">
    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
  </div>
);

export default ReportPage;

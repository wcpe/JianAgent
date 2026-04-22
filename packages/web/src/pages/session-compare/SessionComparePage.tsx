import { useState, useCallback, useEffect } from 'react';
import { sessionApi, type SessionSummaryUI } from '../../api/session.api.js';
import { apiFetch } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';

/* ── Types ── */

interface CompareItem {
  readonly [key: string]: unknown;
  readonly id: string;
  readonly name?: string;
  readonly state: string;
  readonly botCount?: number;
  readonly durationSec?: number;
  readonly phasesCount?: number;
  readonly avgTps?: number;
  readonly peakMemoryMb?: number;
  readonly currentPhase?: string | null;
  readonly createdAt?: string;
}

interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly format: (v: unknown) => string;
  readonly bestFn?: 'max' | 'min';
}

/* ── Field Definitions ── */

const FIELDS: readonly FieldDef[] = [
  { key: 'state', label: '状态', format: (v) => String(v ?? '-') },
  { key: 'name', label: '名称', format: (v) => String(v ?? '-') },
  { key: 'botCount', label: 'Bot 数量', format: (v) => (v != null ? String(v) : '-'), bestFn: 'max' },
  { key: 'durationSec', label: '持续时长 (秒)', format: (v) => (v != null ? String(v) : '-') },
  { key: 'phasesCount', label: '阶段数', format: (v) => (v != null ? String(v) : '-') },
  { key: 'avgTps', label: '平均 TPS', format: (v) => (v != null ? Number(v).toFixed(1) : '-'), bestFn: 'max' },
  { key: 'peakMemoryMb', label: '峰值内存 (MB)', format: (v) => (v != null ? String(v) : '-'), bestFn: 'min' },
  { key: 'currentPhase', label: '当前阶段', format: (v) => String(v ?? '-') },
  { key: 'createdAt', label: '创建时间', format: (v) => (v ? new Date(v as string).toLocaleString() : '-') },
];

/* ── Helpers ── */

function findBestWorst(items: readonly CompareItem[], key: string, mode: 'max' | 'min') {
  const values = items.map((s) => (s as Record<string, unknown>)[key]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return { best: null, worst: null };
  const best = mode === 'max' ? Math.max(...values) : Math.min(...values);
  const worst = mode === 'max' ? Math.min(...values) : Math.max(...values);
  return { best, worst };
}

function cellColor(value: unknown, best: number | null, worst: number | null): string {
  if (typeof value !== 'number' || best === null || worst === null) return '';
  if (best === worst) return '';
  if (value === best) return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
  if (value === worst) return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
  return '';
}

function badgeFor(value: unknown, best: number | null, worst: number | null): string | null {
  if (typeof value !== 'number' || best === null || worst === null || best === worst) return null;
  if (value === best) return '最佳';
  if (value === worst) return '最差';
  return null;
}

/* ── Main Page ── */

export function SessionComparePage() {
  const [sessions, setSessions] = useState<readonly SessionSummaryUI[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [compareResult, setCompareResult] = useState<readonly CompareItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sessionApi.list().then((res) => setSessions(res.data));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }, []);

  const handleCompare = useCallback(async () => {
    if (selected.size < 2) return;
    setLoading(true);
    try {
      const ids = Array.from(selected).join(',');
      const res = await apiFetch<{ success: boolean; data: CompareItem[] }>(`/sessions/compare?ids=${encodeURIComponent(ids)}`);
      setCompareResult(res.data);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">会话对比</h1>

      {/* Selection */}
      <div>
        {sessions.length < 2 ? (
          <EmptyState title="至少需要 2 个会话才能对比" description="请先创建更多压测会话" />
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">选择 2-5 个会话进行对比</p>
            <div className="space-y-1 max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800/50">
              {sessions.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1.5 rounded">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    disabled={!selected.has(s.id) && selected.size >= 5}
                    className="accent-blue-600"
                  />
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.id.slice(0, 8)}</span>
                  <span className="text-gray-800 dark:text-gray-200">{s.name}</span>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{s.state}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleCompare}
              disabled={selected.size < 2 || loading}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '对比中…' : '对比'}
            </button>
          </>
        )}
      </div>

      {/* Compare Table */}
      {compareResult && <CompareTable items={compareResult} />}
    </div>
  );
}

/* ── Compare Table ── */

function CompareTable({ items }: { readonly items: readonly CompareItem[] }) {
  return (
    <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="p-3 text-left text-gray-600 dark:text-gray-400 font-medium">字段</th>
            {items.map((s) => (
              <th key={s.id} className="p-3 text-left text-gray-800 dark:text-gray-200 font-medium">{s.name ?? s.id.slice(0, 8)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FIELDS.map((field) => {
            const { best, worst } = field.bestFn ? findBestWorst(items, field.key, field.bestFn) : { best: null, worst: null };
            return (
              <tr key={field.key} className="border-t border-gray-100 dark:border-gray-700/50">
                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">{field.label}</td>
                {items.map((s) => {
                  const val = (s as Record<string, unknown>)[field.key];
                  const color = cellColor(val, best, worst);
                  const badge = badgeFor(val, best, worst);
                  return (
                    <td key={s.id} className={`p-3 text-gray-800 dark:text-gray-200 ${color}`}>
                      <span>{field.format(val)}</span>
                      {badge && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${badge === '最佳' ? 'bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-400'}`}>{badge}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

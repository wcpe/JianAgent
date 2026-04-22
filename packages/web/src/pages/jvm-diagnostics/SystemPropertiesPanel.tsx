import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JavaHelperStatusDto } from '@jian-agent/shared-domain';

interface SystemPropertiesPanelProps {
  serverId: string;
  helperStatus: JavaHelperStatusDto | null;
}

const KEY_SYSTEM_PROPS = [
  'java.version',
  'java.vendor',
  'java.home',
  'java.vm.name',
  'java.vm.version',
  'java.vm.vendor',
  'java.runtime.name',
  'java.runtime.version',
  'java.specification.version',
  'os.name',
  'os.version',
  'os.arch',
  'user.name',
  'user.dir',
  'file.separator',
  'path.separator',
  'line.separator',
  'file.encoding',
  'sun.jnu.encoding',
  'user.timezone',
  'user.language',
  'user.country',
];

export function SystemPropertiesPanel({ serverId, helperStatus }: SystemPropertiesPanelProps) {
  const [props, setProps] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const capabilities = helperStatus?.capabilities;
  const evalEnabled = capabilities?.evalScript?.enabled ?? false;

  const fetchProperties = useCallback(async () => {
    if (!evalEnabled) return;
    setLoading(true);
    setError(null);
    try {
      // Use evalScript to get system properties
      const res = await fetch('/api/java-helper/eval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          script: 'var props = System.getProperties(); var result = new java.util.HashMap(); for(var e = props.entrySet().iterator(); e.hasNext();) { var entry = e.next(); result.put(entry.getKey(), entry.getValue().toString()); } result;',
          language: 'js',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.data) {
        setProps(data.data as Record<string, string>);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [evalEnabled]);

  const filteredProps = useMemo(() => {
    if (!props) return [];
    const entries = Object.entries(props).sort((a, b) => a[0].localeCompare(b[0]));
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
  }, [props, search]);

  const highlightedProps = useMemo(() => {
    if (!props) return [];
    return KEY_SYSTEM_PROPS.filter((k) => props[k] !== undefined).map((k) => [k, props[k]] as [string, string]);
  }, [props]);

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">系统属性 (System Properties)</h2>
        <button
          onClick={fetchProperties}
          disabled={!evalEnabled || loading}
          className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '获取中…' : '获取属性'}
        </button>
      </div>

      {!evalEnabled && helperStatus && (
        <div className="mb-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-3">
          需要 JVM Script Eval 能力才能读取系统属性。当前 Helper 状态: {helperStatus.state}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {props && (
        <>
          {highlightedProps.length > 0 && (
            <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h3 className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">关键属性</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {highlightedProps.map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="font-mono text-primary-600 dark:text-primary-400 whitespace-nowrap">{key}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索属性名或值…"
              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="overflow-auto max-h-[28rem] border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-[40%]">属性名</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium">值</th>
                </tr>
              </thead>
              <tbody>
                {filteredProps.map(([key, value]) => (
                  <tr key={key} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-2 font-mono text-gray-700 dark:text-gray-300 break-all">{key}</td>
                    <td className="p-2 font-mono text-gray-600 dark:text-gray-400 break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProps.length === 0 && (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                {search ? '无匹配属性' : '暂无属性数据'}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            共 {Object.keys(props).length} 个属性 {search ? `(已过滤 ${filteredProps.length} 个)` : ''}
          </div>
        </>
      )}

      {!props && !loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          {evalEnabled ? '点击"获取属性"读取 JVM 系统属性' : '请先附着到支持 Script Eval 的 JVM 进程'}
        </p>
      )}
    </section>
  );
}

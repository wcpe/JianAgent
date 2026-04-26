import { type FC, useState, useEffect, useCallback } from 'react';
import { startTemplateApi } from '../../api/start-template.api.js';
import { javaRuntimeApi } from '../../api/java-runtime.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { StartTemplateDto, CreateStartTemplateDto } from '@jian-agent/shared-domain';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

/* ── Styles ── */

const inputCls = 'mt-1 block w-full rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
const labelCls = 'text-xs text-gray-500 dark:text-gray-400';
const cardCls = 'bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg';

/* ── Helpers ── */

const parseLines = (s: string): string[] => s.split('\n').map((l) => l.trim()).filter(Boolean);

function parseEnvVars(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      result[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
  return result;
}

/* ── Main Page ── */

const StartTemplatePage: FC = () => {
  const [templates, setTemplates] = useState<readonly StartTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [javaPath, setJavaPath] = useState('');
  const [jvmArgsStr, setJvmArgsStr] = useState('');
  const [serverArgsStr, setServerArgsStr] = useState('');
  const [envVarsStr, setEnvVarsStr] = useState('');
  const [encoding, setEncoding] = useState('utf-8');
  const [runtimeId, setRuntimeId] = useState('');

  // Runtime registry state
  const [runtimes, setRuntimes] = useState<readonly { id: string; name: string; version: string; isDefault: boolean }[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = useState(false);

  useEffect(() => {
    setLoadingRuntimes(true);
    javaRuntimeApi.findAll()
      .then(setRuntimes)
      .catch(() => setRuntimes([]))
      .finally(() => setLoadingRuntimes(false));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await startTemplateApi.getAll();
      setTemplates(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = useCallback(() => {
    setName(''); setJavaPath(''); setJvmArgsStr(''); setServerArgsStr(''); setEnvVarsStr('');
    setEncoding('utf-8'); setRuntimeId(''); setEditId(null); setShowForm(false);
  }, []);

  const openEdit = useCallback((t: StartTemplateDto) => {
    setName(t.name);
    setJavaPath(t.javaPath);
    setJvmArgsStr(t.jvmArgs.join('\n'));
    setServerArgsStr(t.serverArgs.join('\n'));
    setEnvVarsStr(Object.entries(t.envVars).map(([k, v]) => `${k}=${v}`).join('\n'));
    setEncoding(t.encoding);
    setRuntimeId(t.runtimeId ?? '');
    setEditId(t.id);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const dto: CreateStartTemplateDto = {
      name, javaPath,
      jvmArgs: parseLines(jvmArgsStr),
      serverArgs: parseLines(serverArgsStr),
      envVars: parseEnvVars(envVarsStr),
      encoding,
      runtimeId: runtimeId.trim() || undefined,
    };
    try {
      if (editId) { await startTemplateApi.update(editId, dto); }
      else { await startTemplateApi.create(dto); }
      resetForm();
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }, [name, javaPath, jvmArgsStr, serverArgsStr, envVarsStr, encoding, runtimeId, editId, resetForm, fetchAll]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({ title: '删除模板', message: '确定要删除此模板？', variant: 'danger', confirmLabel: '删除' });
    if (!confirmed) return;
    try {
      await startTemplateApi.delete(id);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">启动模板</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          新增模板
        </button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Form */}
      {showForm && (
        <div className={`${cardCls} p-6 space-y-4 border border-gray-200 dark:border-gray-700`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editId ? '编辑模板' : '新增模板'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>模板名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Java 运行时（可选）</span>
              <select
                value={runtimeId}
                onChange={(e) => setRuntimeId(e.target.value)}
                className={inputCls}
                disabled={loadingRuntimes}
              >
                <option value="">-- 手动指定 Java 路径 --</option>
                {runtimes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} (Java {rt.version}){rt.isDefault ? ' [默认]' : ''}
                  </option>
                ))}
              </select>
            </label>
            {!runtimeId && (
            <label className="block">
              <span className={labelCls}>Java 路径</span>
              <input value={javaPath} onChange={(e) => setJavaPath(e.target.value)} className={inputCls} />
            </label>
            )}
            <label className="block">
              <span className={labelCls}>JVM 参数 (每行一个)</span>
              <textarea value={jvmArgsStr} onChange={(e) => setJvmArgsStr(e.target.value)} rows={3} className={`${inputCls} font-mono`} />
            </label>
            <label className="block">
              <span className={labelCls}>服务器参数 (每行一个)</span>
              <textarea value={serverArgsStr} onChange={(e) => setServerArgsStr(e.target.value)} rows={3} className={`${inputCls} font-mono`} />
            </label>
            <label className="block">
              <span className={labelCls}>环境变量 (KEY=VALUE 每行一个)</span>
              <textarea value={envVarsStr} onChange={(e) => setEnvVarsStr(e.target.value)} rows={3} className={`${inputCls} font-mono`} />
            </label>
            <label className="block">
              <span className={labelCls}>编码</span>
              <input value={encoding} onChange={(e) => setEncoding(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              {editId ? '保存' : '创建'}
            </button>
            <button onClick={resetForm} className="rounded bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">加载中...</p>
      ) : (
        <div className={`${cardCls} border border-gray-200 dark:border-gray-700 overflow-hidden`}>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-4">名称</th>
                <th className="py-3 px-4">Java 路径</th>
                <th className="py-3 px-4">编码</th>
                <th className="py-3 px-4">创建时间</th>
                <th className="py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-800 dark:text-gray-200">{t.name}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px]">{t.runtimeId ? `[运行时: ${t.runtimeId.slice(0, 8)}...]` : t.javaPath}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{t.encoding}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 flex gap-2">
                    <button onClick={() => openEdit(t)} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">编辑</button>
                    <button onClick={() => handleDelete(t.id)} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">删除</button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-500">暂无模板</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export { StartTemplatePage };
export default StartTemplatePage;

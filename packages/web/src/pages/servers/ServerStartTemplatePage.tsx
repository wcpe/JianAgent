import { useState, useEffect, useCallback, useMemo } from 'react';
import { startTemplateApi } from '../../api/start-template.api.js';
import type { StartTemplateDto, CreateStartTemplateDto } from '@jian-agent/shared-domain';
import { Plus, Trash2, Edit, Save, X, FileCode, Copy, Filter } from 'lucide-react';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

export function ServerStartTemplatePage() {
  const [templates, setTemplates] = useState<readonly StartTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('__all__');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await startTemplateApi.getAll();
      setTemplates(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载模板失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.templateGroup) set.add(t.templateGroup);
    });
    return Array.from(set).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (groupFilter === '__all__') return templates;
    return templates.filter((t) => t.templateGroup === groupFilter);
  }, [templates, groupFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StartTemplateDto[]>();
    filteredTemplates.forEach((t) => {
      const g = t.templateGroup || '未分组';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(t);
    });
    return map;
  }, [filteredTemplates]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    try {
      await startTemplateApi.delete(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleClone = async (t: StartTemplateDto) => {
    try {
      await startTemplateApi.create({
        name: `${t.name} (副本)`,
        javaPath: t.javaPath,
        jvmArgs: [...t.jvmArgs],
        serverArgs: [...t.serverArgs],
        envVars: { ...t.envVars },
        encoding: t.encoding,
        runtimeId: t.runtimeId,
        templateGroup: t.templateGroup,
        description: t.description,
      });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '复制失败');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileCode className="w-6 h-6" />
          启动模板管理
        </h1>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Group filter */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
          >
            <option value="__all__">全部分组</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      )}

      {showCreate && (
        <TemplateForm
          onSave={async (data) => {
            await startTemplateApi.create(data);
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">加载中...</div>
      ) : templates.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 space-y-2">
          <FileCode className="w-12 h-12 mx-auto opacity-50" />
          <p>暂无启动模板</p>
          <p className="text-xs">创建模板以快速配置服务器启动参数</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {group}
              </h2>
              <div className="space-y-3">
                {items.map((t) =>
                  editingId === t.id ? (
                    <TemplateForm
                      key={t.id}
                      initial={t}
                      onSave={async (data) => {
                        await startTemplateApi.update(t.id, data);
                        setEditingId(null);
                        load();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onEdit={() => setEditingId(t.id)}
                      onDelete={() => handleDelete(t.id)}
                      onClone={() => handleClone(t)}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p>• 启动模板定义了 Java 路径、JVM 参数、服务器参数和环境变量</p>
        <p>• 创建服务器配置时可选择模板快速填充启动参数</p>
        <p>• 修改模板不会影响已创建的服务器配置</p>
      </div>
    </div>
  );
}

// ── Template Card ──

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onClone,
}: {
  readonly template: StartTemplateDto;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onClone: () => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <p>
              <span className="font-medium">Java:</span>{' '}
              <span className="font-mono">{template.javaPath}</span>
            </p>
            {template.jvmArgs.length > 0 && (
              <p>
                <span className="font-medium">JVM 参数:</span>{' '}
                <span className="font-mono">{template.jvmArgs.join(' ')}</span>
              </p>
            )}
            {template.serverArgs.length > 0 && (
              <p>
                <span className="font-medium">服务器参数:</span>{' '}
                <span className="font-mono">{template.serverArgs.join(' ')}</span>
              </p>
            )}
            {Object.keys(template.envVars).length > 0 && (
              <p>
                <span className="font-medium">环境变量:</span>{' '}
                {Object.entries(template.envVars).map(([k, v]) => `${k}=${v}`).join(', ')}
              </p>
            )}
            <p>
              <span className="font-medium">编码:</span> {template.encoding}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onClone}
            className="p-1.5 text-gray-500 hover:text-success-600 dark:text-gray-400 dark:hover:text-success-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="复制模板"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-danger-600 dark:text-gray-400 dark:hover:text-danger-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Form ──

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  readonly initial?: StartTemplateDto;
  readonly onSave: (data: CreateStartTemplateDto) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [javaPath, setJavaPath] = useState(initial?.javaPath ?? 'java');
  const [jvmArgs, setJvmArgs] = useState(initial?.jvmArgs.join(' ') ?? '-Xmx2G -Xms1G');
  const [serverArgs, setServerArgs] = useState(initial?.serverArgs.join(' ') ?? 'nogui');
  const [envVars, setEnvVars] = useState(
    initial ? Object.entries(initial.envVars).map(([k, v]) => `${k}=${v}`).join('\n') : '',
  );
  const [encoding, setEncoding] = useState(initial?.encoding ?? 'utf-8');
  const [templateGroup, setTemplateGroup] = useState(initial?.templateGroup ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !javaPath.trim()) {
      setError('名称和 Java 路径为必填项');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const envMap: Record<string, string> = {};
      envVars
        .split('\n')
        .filter((l) => l.includes('='))
        .forEach((l) => {
          const idx = l.indexOf('=');
          envMap[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
        });

      await onSave({
        name: name.trim(),
        javaPath: javaPath.trim(),
        jvmArgs: jvmArgs.trim() ? jvmArgs.trim().split(/\s+/) : [],
        serverArgs: serverArgs.trim() ? serverArgs.trim().split(/\s+/) : [],
        envVars: envMap,
        encoding,
        templateGroup: templateGroup.trim() || undefined,
        description: description.trim() || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/20 space-y-3">
      <h3 className="font-medium text-gray-900 dark:text-gray-100">
        {initial ? '编辑模板' : '新建模板'}
      </h3>

      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">模板名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: Paper 高性能"
            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分组</label>
          <input
            type="text"
            value={templateGroup}
            onChange={(e) => setTemplateGroup(e.target.value)}
            placeholder="例如: Paper, Forge"
            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">描述</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="模板的简要说明"
          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Java 路径</label>
          <input
            type="text"
            value={javaPath}
            onChange={(e) => setJavaPath(e.target.value)}
            placeholder="java"
            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">输出编码</label>
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
          >
            <option value="utf-8">UTF-8</option>
            <option value="gbk">GBK (中文 Windows)</option>
            <option value="euc-kr">EUC-KR</option>
            <option value="shift_jis">Shift_JIS</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">JVM 参数（空格分隔）</label>
        <input
          type="text"
          value={jvmArgs}
          onChange={(e) => setJvmArgs(e.target.value)}
          placeholder="-Xmx2G -Xms1G -XX:+UseG1GC"
          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">服务器参数（空格分隔）</label>
        <input
          type="text"
          value={serverArgs}
          onChange={(e) => setServerArgs(e.target.value)}
          placeholder="nogui"
          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">环境变量（每行 KEY=VALUE）</label>
        <textarea
          value={envVars}
          onChange={(e) => setEnvVars(e.target.value)}
          placeholder={'JAVA_HOME=/usr/lib/jvm/java-21\nMAVEN_OPTS=-Xmx512m'}
          rows={3}
          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 font-mono resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          <X className="w-4 h-4" />
          取消
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { ServerStatusBadge } from '../../components/status/ServerStatusBadge.js';
import { useServerStore } from '../../stores/server.store.js';
import { serverApi } from '../../api/server.api.js';
import { startTemplateApi } from '../../api/start-template.api.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import type { UpdateServerConfigRequest, ServerWithStatusDto } from '@jian-agent/shared-domain';

interface FormState {
  name: string;
  javaPath: string;
  jarPath: string;
  workDir: string;
  jvmArgs: string;
  serverArgs: string;
  envVars: readonly { key: string; value: string }[];
  autoRestart: boolean;
  maxRestarts: number;
}

function configToForm(c: ServerWithStatusDto): FormState {
  return {
    name: c.name,
    javaPath: '',
    jarPath: c.jarPath,
    workDir: c.workDir,
    jvmArgs: '',
    serverArgs: '',
    envVars: [],
    autoRestart: false,
    maxRestarts: 3,
  };
}

function formToDto(f: FormState): UpdateServerConfigRequest {
  const envVars: Record<string, string> = {};
  for (const { key, value } of f.envVars) {
    if (key.trim()) envVars[key.trim()] = value;
  }
  return {
    name: f.name,
    javaPath: f.javaPath,
    jarPath: f.jarPath,
    workDir: f.workDir,
    jvmArgs: f.jvmArgs.split(/\s+/).filter(Boolean),
    serverArgs: f.serverArgs.split(/\s+/).filter(Boolean),
    envVars,
    autoRestart: f.autoRestart,
    maxRestarts: f.maxRestarts,
  };
}

const EMPTY_FORM: FormState = {
  name: '',
  javaPath: '',
  jarPath: '',
  workDir: '',
  jvmArgs: '',
  serverArgs: '',
  envVars: [],
  autoRestart: false,
  maxRestarts: 3,
};

export function ServerConfigPage() {
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const status = servers.find((s) => s.id === selectedId) ?? servers[0] ?? null;
  const configs = servers;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    const config = configs.find((c) => c.id === selectedId);
    if (config) {
      setForm(configToForm(config));
    } else if (configs.length > 0) {
      setSelectedId(configs[0].id);
      setForm(configToForm(configs[0]));
    }
  }, [selectedId, configs]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (!selectedId) return;
    if (!form.javaPath || !form.jarPath || !form.workDir) {
      setMessage('Java 路径、Jar 路径和工作目录为必填');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await serverApi.updateServer(selectedId, formToDto(form));
      await fetchServers();
      setMessage('保存成功');
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    if (!selectedId) return;
    try {
      await serverApi.startServer(selectedId);
      await fetchServers();
      setMessage('启动命令已发送');
    } catch (err: any) {
      setMessage(`启动失败: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      if (!selectedId) return;
      await serverApi.stopServer(selectedId);
      await fetchServers();
      setMessage('停止命令已发送');
    } catch (err: any) {
      setMessage(`停止失败: ${err.message}`);
    }
  };

  const handleRestart = async () => {
    if (!selectedId) return;
    try {
      await serverApi.restartServer(selectedId);
      await fetchServers();
      setMessage('重启命令已发送');
    } catch (err: any) {
      setMessage(`重启失败: ${err.message}`);
    }
  };

  const addEnvVar = () => {
    setForm((prev) => ({ ...prev, envVars: [...prev.envVars, { key: '', value: '' }] }));
  };

  const removeEnvVar = (index: number) => {
    setForm((prev) => ({ ...prev, envVars: prev.envVars.filter((_, i) => i !== index) }));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    setForm((prev) => ({
      ...prev,
      envVars: prev.envVars.map((e, i) => (i === index ? { ...e, [field]: val } : e)),
    }));
  };

  const isRunning = status?.runtimeStatus === 'running' || status?.runtimeStatus === 'starting';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">服务器配置</h1>
      {message && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${message.includes('失败') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Configuration Form */}
        <div className="flex-1 bg-white rounded-lg shadow p-6">
          {configs.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-1">选择配置</label>
              <StyledSelect
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </StyledSelect>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">名称</label>
              <input value={form.name} onChange={(e) => updateField('name', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Java 路径 *</label>
              <input value={form.javaPath} onChange={(e) => updateField('javaPath', e.target.value)} disabled={isRunning} className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Jar 路径 *</label>
              <input value={form.jarPath} onChange={(e) => updateField('jarPath', e.target.value)} disabled={isRunning} className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">工作目录 *</label>
              <input value={form.workDir} onChange={(e) => updateField('workDir', e.target.value)} disabled={isRunning} className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">JVM 参数</label>
              <textarea value={form.jvmArgs} onChange={(e) => updateField('jvmArgs', e.target.value)} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">启动参数</label>
              <textarea value={form.serverArgs} onChange={(e) => updateField('serverArgs', e.target.value)} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">环境变量</label>
              {form.envVars.map((env, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input value={env.key} onChange={(e) => updateEnvVar(i, 'key', e.target.value)} placeholder="KEY" className="flex-1 border rounded px-2 py-1 text-sm" />
                  <input value={env.value} onChange={(e) => updateEnvVar(i, 'value', e.target.value)} placeholder="VALUE" className="flex-1 border rounded px-2 py-1 text-sm" />
                  <button onClick={() => removeEnvVar(i)} className="text-red-500 text-sm px-2">×</button>
                </div>
              ))}
              <button onClick={addEnvVar} className="text-blue-600 text-sm mt-1">+ 添加变量</button>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.autoRestart} onChange={(e) => updateField('autoRestart', e.target.checked)} />
                自动重启
              </label>
              <label className="text-sm text-gray-500">
                最大重启次数:
                <input type="number" value={form.maxRestarts} onChange={(e) => updateField('maxRestarts', Number(e.target.value))} min={0} max={100} className="ml-2 w-16 border rounded px-2 py-1 text-sm" />
              </label>
            </div>

            <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {/* Right: Operations Panel */}
        <div className="w-64 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm text-gray-500 mb-2">服务器状态</h3>
            {status ? <ServerStatusBadge state={status.runtimeStatus?.toUpperCase() ?? 'STOPPED'} /> : <span className="text-gray-400 text-sm">未知</span>}
          </div>

          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <h3 className="text-sm text-gray-500 mb-2">操作</h3>
            <button onClick={handleStart} disabled={isRunning || !selectedId} className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
              启动
            </button>
            <button onClick={handleStop} disabled={!isRunning} className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
              停止
            </button>
            <button onClick={handleRestart} disabled={!isRunning || !selectedId} className="w-full bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700 disabled:opacity-50">
              重启
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

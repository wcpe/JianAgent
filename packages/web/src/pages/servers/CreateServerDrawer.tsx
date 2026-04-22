import { useState, useEffect } from 'react';
import { useServerStore } from '../../stores/server.store.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { serverApi } from '../../api/server.api.js';
import { javaRuntimeApi } from '../../api/java-runtime.api.js';
import { startTemplateApi } from '../../api/start-template.api.js';
import type { CreateServerConfigRequest, ServerType, SshAuthType } from '@jian-agent/shared-domain';
import type { StartTemplateDto } from '@jian-agent/shared-domain';

interface CreateServerDrawerProps {
  readonly onClose: () => void;
  readonly initialServerType?: ServerType;
  readonly title?: string;
}

function parseEnvVars(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  text
    .split('\n')
    .filter((l) => l.includes('='))
    .forEach((l) => {
      const idx = l.indexOf('=');
      map[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
  return map;
}

export function CreateServerDrawer({
  onClose,
  initialServerType = 'managed',
  title = '新建服务器',
}: CreateServerDrawerProps) {
  const createServer = useServerStore((s) => s.createServer);

  const [serverType, setServerType] = useState<ServerType>(initialServerType);
  const [name, setName] = useState('');
  const [jarPath, setJarPath] = useState('');
  const [workDir, setWorkDir] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(25565);
  const [serverArgs, setServerArgs] = useState('');
  const [javaPath, setJavaPath] = useState('');
  const [jvmArgs, setJvmArgs] = useState('');
  const [autoRestart, setAutoRestart] = useState(false);
  const [maxRestarts, setMaxRestarts] = useState(3);
  const [runtimeId, setRuntimeId] = useState('');
  const [serverGroup, setServerGroup] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSH config
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState('root');
  const [sshAuthType, setSshAuthType] = useState<SshAuthType>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  const [serverDir, setServerDir] = useState('');
  const [showSsh, setShowSsh] = useState(false);
  const [sshTesting, setSshTesting] = useState(false);
  const [sshTestResult, setSshTestResult] = useState<{ success: boolean; message: string } | null>(null);
  // Runtime registry state
  const [runtimes, setRuntimes] = useState<readonly { id: string; name: string; version: string; isDefault: boolean }[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = useState(false);
  // Templates state
  const [templates, setTemplates] = useState<readonly StartTemplateDto[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    setLoadingRuntimes(true);
    javaRuntimeApi.findAll()
      .then(setRuntimes)
      .catch(() => setRuntimes([]))
      .finally(() => setLoadingRuntimes(false));
    setLoadingTemplates(true);
    startTemplateApi.getAll()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  const handleTemplateImport = (templateId: string) => {
    const t = templates.find((tp) => tp.id === templateId);
    if (!t) return;
    setJvmArgs(t.jvmArgs.join(' '));
    setServerArgs(t.serverArgs.join(' '));
    setJavaPath(t.javaPath || 'java');
    setRuntimeId(t.runtimeId || '');
    // Set envVars from template
    setEnvVarsText(Object.entries(t.envVars).map(([k, v]) => `${k}=${v}`).join('\n'));
  };

  const [envVarsText, setEnvVarsText] = useState('');

  const isExternal = serverType === 'external';

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名称为必填');
      return;
    }
    if (!isExternal && (!jarPath.trim() || !workDir.trim())) {
      setError('托管模式下 Jar路径、工作目录为必填');
      return;
    }
    if (isExternal && !host.trim()) {
      setError('外置模式下 Host 为必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dto: CreateServerConfigRequest = {
        name: name.trim(),
        serverType,
        host,
        port,
        serverGroup: serverGroup.trim() || undefined,
        tags: tagsInput.trim() ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        description: description.trim() || undefined,
        ...(isExternal ? {} : {
          runtimeId: runtimeId.trim() || undefined,
          jarPath: jarPath.trim(),
          workDir: workDir.trim(),
          javaPath: javaPath.trim() || 'java',
          jvmArgs: jvmArgs.split(/\s+/).filter(Boolean),
          serverArgs: serverArgs.split(/\s+/).filter(Boolean),
          envVars: parseEnvVars(envVarsText),
          autoRestart,
          maxRestarts,
        }),
        ...(sshHost.trim() ? {
          sshHost: sshHost.trim(),
          sshPort,
          sshUsername: sshUsername.trim(),
          sshAuthType,
          sshPassword: sshAuthType === 'password' ? sshPassword : undefined,
          sshKeyPath: sshAuthType === 'key' ? sshKeyPath.trim() : undefined,
          sshPassphrase: sshAuthType === 'key' ? sshPassphrase : undefined,
          serverDir: serverDir.trim() || undefined,
        } : {}),
      };
      await createServer(dto);
      useDialogStore.getState().showToast(`服务器 "${name.trim()}" 创建成功`, 'success');
      onClose();
    } catch (err: any) {
      setError(err.message ?? '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded px-3 py-2">{error}</div>}

          {/* Template import */}
          {!isExternal && templates.length > 0 && (
            <div>
              <label className={labelClass}>从模板导入</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleTemplateImport(e.target.value);
                  e.target.value = '';
                }}
                className={inputClass}
                disabled={loadingTemplates}
              >
                <option value="">-- 选择模板以快速填充启动参数 --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.templateGroup ? ` [${t.templateGroup}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Server type toggle */}
          <div>
            <label className={labelClass}>服务器类型</label>
            <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setServerType('managed')}
                className={`flex-1 py-2 text-sm ${serverType === 'managed' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                托管服务器
              </button>
              <button
                type="button"
                onClick={() => setServerType('external')}
                className={`flex-1 py-2 text-sm ${serverType === 'external' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                外置服务器
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isExternal ? '通过 Ping 检测已运行的远程/本地服务器状态' : '由平台启动和管理的服务器进程'}
            </p>
          </div>

          <div>
            <label className={labelClass}>名称 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          {/* Group and Tags */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>分组</label>
              <input value={serverGroup} onChange={(e) => setServerGroup(e.target.value)} placeholder="可选分组名称" className={inputClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>标签</label>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="逗号分隔，如：生产,核心" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="服务器描述（可选）" className={inputClass} />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>Host {isExternal ? '*' : ''}</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} />
            </div>
            <div className="w-28">
              <label className={labelClass}>Port</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          {!isExternal && (
            <>
              <div>
                <label className={labelClass}>Jar 路径 *</label>
                <input value={jarPath} onChange={(e) => setJarPath(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>工作目录 *</label>
                <input value={workDir} onChange={(e) => setWorkDir(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>启动参数</label>
                <input value={serverArgs} onChange={(e) => setServerArgs(e.target.value)} placeholder="nogui" className={inputClass} />
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showAdvanced ? '收起高级选项' : '展开高级选项'}
              </button>

              {showAdvanced && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div>
                    <label className={labelClass}>Java 运行时（可选）</label>
                    <select
                      value={runtimeId}
                      onChange={(e) => setRuntimeId(e.target.value)}
                      className={inputClass}
                      disabled={loadingRuntimes}
                    >
                      <option value="">-- 手动指定 Java 路径 --</option>
                      {runtimes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name} (Java {rt.version}){rt.isDefault ? ' [默认]' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      选择已注册的 Java 运行时，或留空手动指定路径
                    </p>
                  </div>
                  {!runtimeId && (
                  <div>
                    <label className={labelClass}>Java 路径</label>
                    <input value={javaPath} onChange={(e) => setJavaPath(e.target.value)} placeholder="java" className={inputClass} />
                  </div>
                  )}
                  <div>
                    <label className={labelClass}>JVM 参数</label>
                    <textarea value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} rows={2} placeholder="-Xmx4G -Xms1G" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>环境变量（每行 KEY=VALUE）</label>
                    <textarea value={envVarsText} onChange={(e) => setEnvVarsText(e.target.value)} rows={2} placeholder="JAVA_HOME=/usr/lib/jvm/java-21" className={inputClass} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={autoRestart} onChange={(e) => setAutoRestart(e.target.checked)} />
                      自动重启
                    </label>
                    <label className="text-sm text-gray-500 dark:text-gray-400">
                      最大重启次数:
                      <input type="number" value={maxRestarts} onChange={(e) => setMaxRestarts(Number(e.target.value))} min={0} max={100} className="ml-2 w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded px-2 py-1 text-sm" />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SSH Config Section */}
          <button
            onClick={() => setShowSsh(!showSsh)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showSsh ? '收起 SSH 配置' : '配置 SSH 远程连接'}
          </button>

          {showSsh && (
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">配置 SSH 后可远程管理服务器终端和文件</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>SSH 主机</label>
                  <input value={sshHost} onChange={(e) => setSshHost(e.target.value)} placeholder="192.168.1.100" className={inputClass} />
                </div>
                <div className="w-24">
                  <label className={labelClass}>端口</label>
                  <input type="number" value={sshPort} onChange={(e) => setSshPort(Number(e.target.value))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>用户名</label>
                <input value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>认证方式</label>
                <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSshAuthType('password')}
                    className={`flex-1 py-2 text-sm ${sshAuthType === 'password' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    密码
                  </button>
                  <button
                    type="button"
                    onClick={() => setSshAuthType('key')}
                    className={`flex-1 py-2 text-sm ${sshAuthType === 'key' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    密钥
                  </button>
                </div>
              </div>
              {sshAuthType === 'password' ? (
                <div>
                  <label className={labelClass}>密码</label>
                  <input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} className={inputClass} />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>密钥路径（服务端本地路径）</label>
                    <input value={sshKeyPath} onChange={(e) => setSshKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>密钥口令（可选）</label>
                    <input type="password" value={sshPassphrase} onChange={(e) => setSshPassphrase(e.target.value)} className={inputClass} />
                  </div>
                </>
              )}
              <div>
                <label className={labelClass}>服务器根目录（可选）</label>
                <input value={serverDir} onChange={(e) => setServerDir(e.target.value)} placeholder="/home/minecraft/server" className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">文件管理器的根目录，留空则使用工作目录</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all duration-150"
          >
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

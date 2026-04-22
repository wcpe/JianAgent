import { useState, useEffect } from 'react';
import { useServerStore } from '../../stores/server.store.js';
import { serverApi } from '../../api/server.api.js';
import { javaRuntimeApi } from '../../api/java-runtime.api.js';
import type { ServerWithStatusDto, UpdateServerConfigRequest, SshAuthType } from '@jian-agent/shared-domain';

interface EditServerDrawerProps {
  readonly server: ServerWithStatusDto;
  readonly onClose: () => void;
}

export function EditServerDrawer({ server, onClose }: EditServerDrawerProps) {
  const updateServer = useServerStore((s) => s.updateServer);
  const isRunning = server.runtimeStatus === 'running' || server.runtimeStatus === 'starting';

  const [name, setName] = useState(server.name);
  const [jarPath, setJarPath] = useState(server.jarPath ?? '');
  const [workDir, setWorkDir] = useState(server.workDir ?? '');
  const [host, setHost] = useState(server.host ?? 'localhost');
  const [port, setPort] = useState(server.port ?? 25565);
  const [serverGroup, setServerGroup] = useState(server.serverGroup ?? '');
  const [tagsInput, setTagsInput] = useState(server.tags?.join(', ') ?? '');
  const [description, setDescription] = useState(server.description ?? '');
  // Fields not in ServerWithStatusDto but may exist at runtime from full config
  const ext = server as unknown as Record<string, unknown>;
  const [javaPath, setJavaPath] = useState(String(ext.javaPath ?? ''));
  const [jvmArgs, setJvmArgs] = useState(Array.isArray(ext.jvmArgs) ? (ext.jvmArgs as string[]).join(' ') : '');
  const [serverArgs, setServerArgs] = useState(Array.isArray(ext.serverArgs) ? (ext.serverArgs as string[]).join(' ') : '');
  const [autoRestart, setAutoRestart] = useState(Boolean(ext.autoRestart ?? false));
  const [maxRestarts, setMaxRestarts] = useState(Number(ext.maxRestarts ?? 3));
  const [logsPath, setLogsPath] = useState(String(ext.logsPath ?? ''));
  const [runtimeId, setRuntimeId] = useState(String(ext.runtimeId ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSH fields
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState('root');
  const [sshAuthType, setSshAuthType] = useState<SshAuthType>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  const [serverDir, setServerDir] = useState('');
  const [showSsh, setShowSsh] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

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

  // Load full config (includes SSH fields)
  useEffect(() => {
    serverApi.getServerConfig(server.id).then((cfg) => {
      setSshHost(cfg.sshHost ?? '');
      setSshPort(cfg.sshPort ?? 22);
      setSshUsername(cfg.sshUsername ?? 'root');
      setSshAuthType(cfg.sshAuthType ?? 'password');
      setSshKeyPath(cfg.sshKeyPath ?? '');
      setServerDir(cfg.serverDir ?? '');
      if (cfg.sshHost) setShowSsh(true);
      setRuntimeId(cfg.runtimeId ?? '');
      setConfigLoaded(true);
    }).catch(() => {
      setConfigLoaded(true);
    });
  }, [server.id]);

  const handleSubmit = async () => {
    if (!name.trim() || !jarPath.trim() || !workDir.trim()) {
      setError('名称、Jar路径、工作目录为必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dto: UpdateServerConfigRequest = {
        name: name.trim(),
        jarPath: jarPath.trim(),
        workDir: workDir.trim(),
        host,
        port,
        serverGroup: serverGroup.trim() || undefined,
        tags: tagsInput.trim() ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        description: description.trim() || undefined,
        runtimeId: runtimeId.trim() || undefined,
        javaPath: javaPath.trim() || 'java',
        jvmArgs: jvmArgs.split(/\s+/).filter(Boolean),
        serverArgs: serverArgs.split(/\s+/).filter(Boolean),
        envVars: {},
        autoRestart,
        maxRestarts,
        logsPath: logsPath.trim() || undefined,
        sshHost: sshHost.trim() || undefined,
        sshPort,
        sshUsername: sshUsername.trim() || undefined,
        sshAuthType,
        sshPassword: sshAuthType === 'password' && sshPassword && sshPassword !== '***' ? sshPassword : undefined,
        sshKeyPath: sshAuthType === 'key' ? sshKeyPath.trim() || undefined : undefined,
        sshPassphrase: sshAuthType === 'key' && sshPassphrase && sshPassphrase !== '***' ? sshPassphrase : undefined,
        serverDir: serverDir.trim() || undefined,
      };
      await updateServer(server.id, dto);
      onClose();
    } catch (err: any) {
      setError(err.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">编辑服务器</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isRunning && (
            <div className="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 rounded px-3 py-2">
              服务器运行中，修改将在下次启动时生效
            </div>
          )}
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">名称 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
          </div>

          {/* Group and Tags */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">分组</label>
              <input value={serverGroup} onChange={(e) => setServerGroup(e.target.value)} placeholder="可选分组名称" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">标签</label>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="逗号分隔，如：生产,核心" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="服务器描述（可选）" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Jar 路径 *</label>
            <input value={jarPath} onChange={(e) => setJarPath(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">服务器 jar 文件的绝对或相对路径（如 server.jar）</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">工作目录 *</label>
            <input value={workDir} onChange={(e) => setWorkDir(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Host</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="w-28">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Port</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Java 运行时（可选）</label>
            <select
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm"
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
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Java 路径</label>
            <input value={javaPath} onChange={(e) => setJavaPath(e.target.value)} placeholder="java" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
          </div>
          )}
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">JVM 参数</label>
            <textarea value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">如 -Xmx4G -Xms2G（空格分隔）</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">启动参数</label>
            <input value={serverArgs} onChange={(e) => setServerArgs(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">如 --nogui（空格分隔）</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">日志目录</label>
            <input value={logsPath} onChange={(e) => setLogsPath(e.target.value)} placeholder="logs" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">相对于工作目录的日志文件夹路径（默认 logs）</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={autoRestart} onChange={(e) => setAutoRestart(e.target.checked)} />
              自动重启
            </label>
            <label className="text-sm text-gray-500 dark:text-gray-400">
              最大重启次数:
              <input type="number" value={maxRestarts} onChange={(e) => setMaxRestarts(Number(e.target.value))} min={0} max={100} className="ml-2 w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm" />
            </label>
          </div>

          {/* SSH Config Section */}
          <button
            onClick={() => setShowSsh(!showSsh)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showSsh ? '收起 SSH 配置' : '配置 SSH 远程连接'}
          </button>

          {showSsh && configLoaded && (
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">配置 SSH 后可远程管理服务器终端和文件</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">SSH 主机</label>
                  <input value={sshHost} onChange={(e) => setSshHost(e.target.value)} placeholder="192.168.1.100" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="w-24">
                  <label className="block text-sm text-gray-500 mb-1">端口</label>
                  <input type="number" value={sshPort} onChange={(e) => setSshPort(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">用户名</label>
                <input value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">认证方式</label>
                <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSshAuthType('password')}
                    className={`flex-1 py-2 text-sm ${sshAuthType === 'password' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                  >
                    密码
                  </button>
                  <button
                    type="button"
                    onClick={() => setSshAuthType('key')}
                    className={`flex-1 py-2 text-sm ${sshAuthType === 'key' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                  >
                    密钥
                  </button>
                </div>
              </div>
              {sshAuthType === 'password' ? (
                <div>
                  <label className="block text-sm text-gray-500 mb-1">密码</label>
                  <input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} placeholder="留空表示不修改" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">密钥路径</label>
                    <input value={sshKeyPath} onChange={(e) => setSshKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">密钥口令</label>
                    <input type="password" value={sshPassphrase} onChange={(e) => setSshPassphrase(e.target.value)} placeholder="留空表示不修改" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-gray-500 mb-1">服务器根目录</label>
                <input value={serverDir} onChange={(e) => setServerDir(e.target.value)} placeholder="/home/minecraft/server" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}

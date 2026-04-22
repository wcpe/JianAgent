import { useState } from 'react';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { CreateRemoteHostRequest } from '@jian-agent/shared-domain';

interface CreateHostDrawerProps {
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly title?: string;
}

export function CreateHostDrawer({
  onClose,
  onCreated,
  title = '新建远程主机',
}: CreateHostDrawerProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名称为必填');
      return;
    }
    if (!host.trim()) {
      setError('主机地址为必填');
      return;
    }
    if (!username.trim()) {
      setError('用户名为必填');
      return;
    }
    if (authType === 'password' && !password) {
      setError('密码为必填');
      return;
    }
    if (authType === 'key' && !keyPath.trim()) {
      setError('密钥路径为必填');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const tags = tagsStr
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const dto: CreateRemoteHostRequest = {
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        ...(authType === 'password' ? { password } : { keyPath: keyPath.trim(), passphrase: passphrase || undefined }),
        ...(tags.length > 0 ? { tags } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      };

      await remoteHostApi.create(dto);
      useDialogStore.getState().showToast(`主机 "${name.trim()}" 创建成功`, 'success');
      onCreated();
    } catch (err: any) {
      setError(err.message ?? '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const buildPreviewRequest = (): CreateRemoteHostRequest => ({
    name: name.trim() || 'preview',
    host: host.trim(),
    port,
    username: username.trim(),
    authType,
    ...(authType === 'password'
      ? { password }
      : { keyPath: keyPath.trim(), passphrase: passphrase || undefined }),
    ...(tagsStr.trim()
      ? {
          tags: tagsStr
            .split(/[,，\s]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        }
      : {}),
    ...(description.trim() ? { description: description.trim() } : {}),
  });

  const handleTest = async () => {
    if (!host.trim() || !username.trim()) {
      setError('测试连接前请先填写主机地址和用户名');
      return;
    }
    if (authType === 'password' && !password) {
      setError('测试连接前请填写密码');
      return;
    }
    if (authType === 'key' && !keyPath.trim()) {
      setError('测试连接前请填写密钥路径');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const result = await remoteHostApi.testConnectionPreview(buildPreviewRequest());
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message ?? '测试失败',
      });
    } finally {
      setTesting(false);
    }
  };

  const inputClass =
    'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded px-3 py-2">{error}</div>
          )}

          <div>
            <label className={labelClass}>名称 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="生产服务器-01" className={inputClass} />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>主机地址 *</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.100" className={inputClass} />
            </div>
            <div className="w-24">
              <label className={labelClass}>端口</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>用户名 *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>认证方式</label>
            <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-2 text-sm ${
                  authType === 'password'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                密码
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-2 text-sm ${
                  authType === 'key'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                密钥
              </button>
            </div>
          </div>

          {authType === 'password' ? (
            <div>
              <label className={labelClass}>密码 *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>密钥路径 *</label>
                <input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>密钥口令（可选）</label>
                <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>标签（逗号分隔）</label>
            <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="生产, 游戏, 北京" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {testResult && (
            <div
              className={`text-sm rounded px-3 py-2 ${
                testResult.success
                  ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
                  : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
              }`}
            >
              {testResult.success ? '✓ ' : '✗ '}
              {testResult.message}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all duration-150"
          >
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

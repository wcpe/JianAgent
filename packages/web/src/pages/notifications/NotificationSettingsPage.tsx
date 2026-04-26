import { useState, useEffect, useCallback } from 'react';
import { notificationApi } from '../../api/notification.api.js';
import type { NotificationChannelDto, NotificationChannelType } from '@jian-agent/shared-domain';
import { Bell, Plus, Trash2, TestTube2, Edit2, Check, X } from 'lucide-react';

const TYPE_LABELS: Record<NotificationChannelType, string> = {
  webhook: 'Webhook',
  dingtalk: '钉钉机器人',
};

export default function NotificationSettingsPage() {
  const [channels, setChannels] = useState<readonly NotificationChannelDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await notificationApi.listChannels();
      setChannels(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此通知渠道？')) return;
    try {
      await notificationApi.deleteChannel(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await notificationApi.testChannel(id);
      setTestResult((prev) => ({ ...prev, [id]: result }));
    } catch (err: unknown) {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, message: err instanceof Error ? err.message : '测试失败' } }));
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await notificationApi.updateChannel(id, { enabled: !enabled });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '切换失败');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          告警通知渠道
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加渠道
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        当触发告警规则时，系统会自动将告警消息推送到已启用的通知渠道。
      </p>

      {error && (
        <div className="p-3 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400 rounded text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <CreateChannelForm
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
          onError={setError}
        />
      )}

      {loading && channels.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">加载中...</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无通知渠道</p>
          <p className="text-xs mt-1">点击「添加渠道」配置 Webhook 或钉钉机器人</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${ch.enabled ? 'bg-success-500' : 'bg-gray-400'}`} />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{ch.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {TYPE_LABELS[ch.type]} · {ch.url.length > 60 ? ch.url.slice(0, 60) + '...' : ch.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testResult[ch.id] && (
                    <span className={`text-xs ${testResult[ch.id].success ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                      {testResult[ch.id].message}
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(ch.id)}
                    className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    title="发送测试"
                  >
                    <TestTube2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(ch.id, ch.enabled)}
                    className={`px-2 py-1 text-xs rounded ${
                      ch.enabled
                        ? 'bg-success-100 text-success-700 dark:bg-success-700/30 dark:text-success-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {ch.enabled ? '已启用' : '已禁用'}
                  </button>
                  <button
                    onClick={() => handleDelete(ch.id)}
                    className="p-1.5 text-danger-500 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-200"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Create Form ---

interface CreateChannelFormProps {
  readonly onCreated: () => void;
  readonly onCancel: () => void;
  readonly onError: (msg: string) => void;
}

function CreateChannelForm({ onCreated, onCancel, onError }: CreateChannelFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NotificationChannelType>('webhook');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) {
      onError('名称和URL为必填项');
      return;
    }
    setSaving(true);
    try {
      await notificationApi.createChannel({
        name: name.trim(),
        type,
        url: url.trim(),
        secret: secret.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">添加通知渠道</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：运维钉钉群"
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NotificationChannelType)}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {type === 'dingtalk' ? '钉钉 Webhook URL' : 'Webhook URL'}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={type === 'dingtalk' ? 'https://oapi.dingtalk.com/robot/send?access_token=...' : 'https://your-webhook-url.com/hook'}
          className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {type === 'dingtalk' ? '签名密钥（加签）' : 'HMAC 签名密钥'} （可选）
        </label>
        <input
          type="text"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={type === 'dingtalk' ? 'SEC...' : 'your-secret-key'}
          className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 font-mono"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
        >
          {saving ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  );
}

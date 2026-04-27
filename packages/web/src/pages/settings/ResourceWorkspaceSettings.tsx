import { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, Edit2, Check, X, Server, Loader2 } from 'lucide-react';
import { resourceWorkspaceApi } from '../../api/resource-workspace.api.js';
import { serverApi } from '../../api/server.api.js';
import { javaRuntimeApi } from '../../api/java-runtime.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { Modal } from '../../components/ui/Modal.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import type { ResourceWorkspaceConfig, QuickProvisionRequest, PaperVersionInfo } from '@jian-agent/shared-domain';

export function ResourceWorkspaceSettings() {
  const [workspaces, setWorkspaces] = useState<ResourceWorkspaceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickProvisionOpen, setQuickProvisionOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await resourceWorkspaceApi.findAll();
      setWorkspaces([...data]);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此资源工作台？')) return;
    try {
      await resourceWorkspaceApi.delete(id);
      useDialogStore.getState().showToast('删除成功', 'success');
      loadWorkspaces();
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message, 'error');
    }
  };

  const handleQuickProvision = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setQuickProvisionOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">资源工作台</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            配置服务器资源根目录，快速创建和管理 Paper 服务器
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          添加工作台
        </button>
      </div>

      {error && <ErrorAlert message={error} className="mb-4" />}

      {workspaces.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-8 text-center">
          <Folder className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">暂无资源工作台</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击上方按钮添加第一个工作台</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ws.name}</h3>
                    {ws.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{ws.basePath}</p>
                  {ws.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{ws.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickProvision(ws.id)}
                    className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    title="快速创建服务器"
                  >
                    <Server size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(ws.id)}
                    className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="编辑"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(ws.id)}
                    className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateWorkspaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={loadWorkspaces}
      />

      {editingId && (
        <EditWorkspaceModal
          workspaceId={editingId}
          onClose={() => setEditingId(null)}
          onSuccess={loadWorkspaces}
        />
      )}

      {quickProvisionOpen && selectedWorkspaceId && (
        <QuickProvisionModal
          workspaceId={selectedWorkspaceId}
          onClose={() => {
            setQuickProvisionOpen(false);
            setSelectedWorkspaceId(null);
          }}
        />
      )}
    </div>
  );
}

interface CreateWorkspaceModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function CreateWorkspaceModal({ open, onClose, onSuccess }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [basePath, setBasePath] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !basePath.trim()) {
      setError('名称和路径为必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resourceWorkspaceApi.create({ name: name.trim(), basePath: basePath.trim(), description: description.trim() || undefined, isDefault });
      useDialogStore.getState().showToast('创建成功', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加资源工作台"
      footer={
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '创建中...' : '创建'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className={labelClass}>名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="例如：生产服务器"
          />
        </div>
        <div>
          <label className={labelClass}>基础路径 *</label>
          <input
            type="text"
            value={basePath}
            onChange={(e) => setBasePath(e.target.value)}
            className={inputClass}
            placeholder="/path/to/servers"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            服务器将在此目录下创建子文件夹
          </p>
        </div>
        <div>
          <label className={labelClass}>描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            rows={2}
            placeholder="可选的描述信息"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDefault"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
            设为默认工作台
          </label>
        </div>
      </div>
    </Modal>
  );
}

interface EditWorkspaceModalProps {
  readonly workspaceId: string;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function EditWorkspaceModal({ workspaceId, onClose, onSuccess }: EditWorkspaceModalProps) {
  const [workspace, setWorkspace] = useState<ResourceWorkspaceConfig | null>(null);
  const [name, setName] = useState('');
  const [basePath, setBasePath] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resourceWorkspaceApi.findOne(workspaceId).then((ws) => {
      setWorkspace(ws);
      setName(ws.name);
      setBasePath(ws.basePath);
      setDescription(ws.description ?? '');
      setIsDefault(ws.isDefault ?? false);
    });
  }, [workspaceId]);

  const handleSubmit = async () => {
    if (!name.trim() || !basePath.trim()) {
      setError('名称和路径为必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resourceWorkspaceApi.update(workspaceId, {
        name: name.trim(),
        basePath: basePath.trim(),
        description: description.trim() || undefined,
        isDefault,
      });
      useDialogStore.getState().showToast('更新成功', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) return null;

  const inputClass = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="编辑资源工作台"
      footer={
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className={labelClass}>名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>基础路径 *</label>
          <input
            type="text"
            value={basePath}
            onChange={(e) => setBasePath(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="editIsDefault"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="editIsDefault" className="text-sm text-gray-700 dark:text-gray-300">
            设为默认工作台
          </label>
        </div>
      </div>
    </Modal>
  );
}

interface QuickProvisionModalProps {
  readonly workspaceId: string;
  readonly onClose: () => void;
}

function QuickProvisionModal({ workspaceId, onClose }: QuickProvisionModalProps) {
  const [serverName, setServerName] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('');
  const [port, setPort] = useState(25565);
  const [maxMemory, setMaxMemory] = useState('2G');
  const [minMemory, setMinMemory] = useState('512M');
  const [runtimeId, setRuntimeId] = useState('');
  const [serverGroup, setServerGroup] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paperVersions, setPaperVersions] = useState<PaperVersionInfo[]>([]);
  const [runtimes, setRuntimes] = useState<readonly { id: string; name: string; version: string }[]>([]);

  useEffect(() => {
    serverApi.listPaperVersions().then(setPaperVersions).catch(() => setPaperVersions([]));
    javaRuntimeApi.findAll().then(setRuntimes).catch(() => setRuntimes([]));
  }, []);

  const handleSubmit = async () => {
    if (!serverName.trim() || !minecraftVersion.trim()) {
      setError('服务器名称和 Minecraft 版本为必填');
      return;
    }
    setProvisioning(true);
    setError(null);
    try {
      const req: QuickProvisionRequest = {
        workspaceId,
        serverName: serverName.trim(),
        minecraftVersion: minecraftVersion.trim(),
        port,
        maxMemory,
        minMemory,
        runtimeId: runtimeId || undefined,
        serverGroup: serverGroup.trim() || undefined,
        tags: tagsInput.trim() ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      };
      await resourceWorkspaceApi.quickProvision(req);
      useDialogStore.getState().showToast(`服务器 "${serverName}" 创建成功`, 'success');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const inputClass = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="快速创建 Paper 服务器"
      size="lg"
      footer={
        <button
          onClick={handleSubmit}
          disabled={provisioning}
          className="w-full bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {provisioning ? '创建中...' : '创建服务器'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className={labelClass}>服务器名称 *</label>
          <input
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className={inputClass}
            placeholder="例如：lobby-1"
          />
        </div>
        <div>
          <label className={labelClass}>Minecraft 版本 *</label>
          <select
            value={minecraftVersion}
            onChange={(e) => setMinecraftVersion(e.target.value)}
            className={inputClass}
          >
            <option value="">-- 选择版本 --</option>
            {paperVersions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} (build {v.latestBuild})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>端口</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Java 运行时</label>
            <select
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
              className={inputClass}
            >
              <option value="">-- 使用默认 --</option>
              {runtimes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.version})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>最大内存</label>
            <input
              type="text"
              value={maxMemory}
              onChange={(e) => setMaxMemory(e.target.value)}
              className={inputClass}
              placeholder="2G"
            />
          </div>
          <div>
            <label className={labelClass}>最小内存</label>
            <input
              type="text"
              value={minMemory}
              onChange={(e) => setMinMemory(e.target.value)}
              className={inputClass}
              placeholder="512M"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>服务器组</label>
          <input
            type="text"
            value={serverGroup}
            onChange={(e) => setServerGroup(e.target.value)}
            className={inputClass}
            placeholder="例如：lobby"
          />
        </div>
        <div>
          <label className={labelClass}>标签</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className={inputClass}
            placeholder="用逗号分隔，例如：production,lobby"
          />
        </div>
      </div>
    </Modal>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { serverApi } from '../../api/server.api.js';
import { PluginOperationBanner } from '../../features/plugin-manager/PluginOperationBanner.js';
import { usePluginOperationStore } from '../../features/plugin-manager/plugin-operation.store.js';
import type { PluginMetadataDto, PluginOperationResultDto } from '@jian-agent/shared-domain';

type PluginDetail = PluginMetadataDto;

interface PluginManagerTabProps {
  readonly serverId: string;
}

export function PluginManagerTab({ serverId }: PluginManagerTabProps) {
  const [plugins, setPlugins] = useState<readonly PluginDetail[]>([]);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordOperation = usePluginOperationStore((s) => s.recordOperation);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await serverApi.listPlugins(serverId);
      console.log('Fetched plugins:', list);
      setPlugins(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOperationResult = (result: PluginOperationResultDto) => {
    recordOperation({
      requestId: result.requestId,
      serverId: result.serverId,
      pluginName: result.pluginName,
      operation: result.operation,
      success: result.success,
      hasConnection: result.hasConnection,
      message: result.message ?? '',
    });
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`确认删除插件 ${name}？`)) return;
    setActionLoading(`delete:${name}`);
    try {
      await serverApi.deletePlugin(serverId, name);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ── File Track Operations ──

  const handleEnable = async (name: string) => {
    setActionLoading(`enable:${name}`);
    try {
      const result = await serverApi.enablePlugin(serverId, name);
      handleOperationResult(result);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '启用失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (name: string) => {
    setActionLoading(`disable:${name}`);
    try {
      const result = await serverApi.disablePlugin(serverId, name);
      handleOperationResult(result);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '禁用失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Hot Track Operations ──

  const handleHotLoad = async (name: string) => {
    setActionLoading(`hot-load:${name}`);
    try {
      const result = await serverApi.hotLoadPlugin(serverId, name);
      handleOperationResult(result);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '热加载失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHotUnload = async (name: string) => {
    setActionLoading(`hot-unload:${name}`);
    try {
      const result = await serverApi.hotUnloadPlugin(serverId, name);
      handleOperationResult(result);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '热卸载失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHotReload = async (name: string) => {
    setActionLoading(`hot-reload:${name}`);
    try {
      const result = await serverApi.hotReloadPlugin(serverId, name);
      handleOperationResult(result);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '热重载失败';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Upload ──

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.jar')) {
      setError('仅支持上传 .jar 文件');
      return;
    }
    setActionLoading('upload');
    setError('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1] ?? '';
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/servers/${encodeURIComponent(serverId)}/plugins/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename: file.name, data: base64 }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || '上传失败');
      }
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传失败';
      setError(msg);
    } finally {
      setActionLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isLoading = (action: string, name: string) => actionLoading === `${action}:${name}`;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">插件管理</h3>
        <div className="flex-1" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={actionLoading === 'upload'}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {actionLoading === 'upload' ? '上传中...' : '上传插件'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jar"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={load}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          刷新
        </button>
      </div>

      {/* Operation Banners */}
      <div className="px-4 pt-3">
        <PluginOperationBanner serverId={serverId} />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/30">{error}</div>
      )}

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
        ) : plugins.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">暂无插件数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
                <tr className="bg-white/40 dark:bg-slate-800/40 border-b border-white/40 dark:border-primary-300/10 text-xs text-gray-600 dark:text-gray-300 font-semibold">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">名称</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-24">版本</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-20">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">文件轨</span>
                    {' '}状态
                  </th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-20">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">热轨</span>
                    {' '}运行
                  </th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-32">作者</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-48">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {plugins.map((plugin, idx) => (
                <React.Fragment key={plugin.name}>
                <tr
                  className={`transition-colors cursor-pointer ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-slate-800/50' : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
                  onClick={() => setExpandedPlugin(expandedPlugin === plugin.name ? null : plugin.name)}
                >
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                    <span className="mr-1 text-gray-400">{expandedPlugin === plugin.name ? '▼' : '▶'}</span>
                    {plugin.name}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{plugin.version || '-'}</td>
                  {/* File Track: Install State */}
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                      plugin.installState === 'INSTALLED'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : plugin.installState === 'CORRUPTED'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                    }`}>
                      {plugin.installState === 'INSTALLED' ? '已安装' : plugin.installState === 'CORRUPTED' ? '损坏' : '已禁用'}
                    </span>
                  </td>
                  {/* Hot Track: Runtime State */}
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                      plugin.runtimeState === 'RUNNING'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : plugin.runtimeState === 'LOAD_ERROR'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                    }`}>
                      {plugin.runtimeState === 'RUNNING' ? '运行中' : plugin.runtimeState === 'LOAD_ERROR' ? '加载错误' : '已停止'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{(plugin.authors || []).join(', ') || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {/* File Track Buttons */}
                      {plugin.installState !== 'DISABLED' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDisable(plugin.name); }}
                          disabled={isLoading('disable', plugin.name)}
                          className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 transition-colors"
                          title="文件轨：禁用（标记 .jar.disabled）"
                        >
                          {isLoading('disable', plugin.name) ? '...' : '禁用'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEnable(plugin.name); }}
                          disabled={isLoading('enable', plugin.name)}
                          className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 transition-colors"
                          title="文件轨：启用（恢复 .jar）"
                        >
                          {isLoading('enable', plugin.name) ? '...' : '启用'}
                        </button>
                      )}
                      {/* Hot Track Buttons */}
                      {plugin.runtimeState === 'RUNNING' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleHotUnload(plugin.name); }}
                            disabled={isLoading('hot-unload', plugin.name)}
                            className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded disabled:opacity-50 transition-colors"
                            title="热轨：卸载运行中的插件"
                          >
                            {isLoading('hot-unload', plugin.name) ? '...' : '热卸载'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleHotReload(plugin.name); }}
                            disabled={isLoading('hot-reload', plugin.name)}
                            className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded disabled:opacity-50 transition-colors"
                            title="热轨：重载插件（卸载+加载）"
                          >
                            {isLoading('hot-reload', plugin.name) ? '...' : '热重载'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleHotLoad(plugin.name); }}
                          disabled={isLoading('hot-load', plugin.name)}
                          className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded disabled:opacity-50 transition-colors"
                          title="热轨：加载插件到运行时"
                        >
                          {isLoading('hot-load', plugin.name) ? '...' : '热加载'}
                        </button>
                      )}
                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(plugin.name); }}
                        disabled={isLoading('delete', plugin.name)}
                        className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
                        title="删除插件 JAR 文件"
                      >
                        {isLoading('delete', plugin.name) ? '...' : '删除'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedPlugin === plugin.name && (
                  <tr key={`${plugin.name}-detail`} className="bg-gray-50 dark:bg-gray-800/30">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                        <div><span className="text-gray-400">主类: </span><span className="text-gray-600 dark:text-gray-300 font-mono">{plugin.mainClass}</span></div>
                        <div><span className="text-gray-400">文件: </span><span className="text-gray-600 dark:text-gray-300 font-mono">{plugin.filename}</span></div>
                        <div><span className="text-gray-400">配置目录: </span><span className="text-gray-600 dark:text-gray-300 font-mono">{plugin.configDir}</span></div>
                        <div>
                          <span className="text-gray-400">文件轨: </span>
                          <span className={`${
                            plugin.installState === 'INSTALLED' ? 'text-green-600 dark:text-green-400' :
                            plugin.installState === 'CORRUPTED' ? 'text-red-600 dark:text-red-400' :
                            'text-gray-500 dark:text-gray-400'
                          }`}>
                            {plugin.installState === 'INSTALLED' ? '已安装' : plugin.installState === 'CORRUPTED' ? '损坏' : '已禁用'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">热轨: </span>
                          <span className={`${
                            plugin.runtimeState === 'RUNNING' ? 'text-green-600 dark:text-green-400' :
                            plugin.runtimeState === 'LOAD_ERROR' ? 'text-red-600 dark:text-red-400' :
                            'text-gray-500 dark:text-gray-400'
                          }`}>
                            {plugin.runtimeState === 'RUNNING' ? '运行中' : plugin.runtimeState === 'LOAD_ERROR' ? '加载错误' : '已停止'}
                          </span>
                        </div>
                        {(plugin.dependencies || []).length > 0 && <div><span className="text-gray-400">依赖: </span><span className="text-gray-600 dark:text-gray-300">{(plugin.dependencies || []).join(', ')}</span></div>}
                        {plugin.requiresRestart && <div><span className="text-gray-400">需要重启: </span><span className="text-yellow-600 dark:text-yellow-400">是</span></div>}
                        {(plugin.riskWarnings || []).length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-400">风险警告: </span>
                            <span className="text-red-600 dark:text-red-400">{(plugin.riskWarnings || []).join('; ')}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

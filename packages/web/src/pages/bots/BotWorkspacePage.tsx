import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBotStore } from '../../stores/bot.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { botApi, type SavedBotConfig } from '../../api/bot.api.js';
import { BotStatsBar } from './BotStatsBar.js';
import { BotTable } from './BotTable.js';
import { BotCardGrid } from './BotCardGrid.js';
import { CreateBotDrawer } from './CreateBotDrawer.js';
import { BotChatPanel } from './BotChatPanel.js';
import { EmptyState } from '../../components/EmptyState.js';
import { ErrorState } from '../../components/ErrorState.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { SCRIPT_PRESETS, type BotScript } from '@jian-agent/shared-protocol';

const SCRIPT_STORAGE_KEY = 'jian-agent:saved-scripts';

function loadLocalScripts(): BotScript[] {
  try {
    return JSON.parse(localStorage.getItem(SCRIPT_STORAGE_KEY) ?? '[]') as BotScript[];
  } catch {
    return [];
  }
}

export function BotWorkspacePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialServerId = params.get('serverId') ?? '';

  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);

  const { bots, stats, loading, error, filter, meta } = useBotStore();
  const fetchBots = useBotStore((s) => s.fetchBots);
  const fetchStats = useBotStore((s) => s.fetchStats);
  const setFilter = useBotStore((s) => s.setFilter);
  const selectBot = useBotStore((s) => s.selectBot);
  const stopBot = useBotStore((s) => s.stopBot);
  const stopAll = useBotStore((s) => s.stopAll);

  const [serverId, setServerId] = useState(initialServerId);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedBots, setSelectedBots] = useState<ReadonlySet<string>>(new Set());
  const [savedConfigs, setSavedConfigs] = useState<readonly SavedBotConfig[]>([]);
  const [batchBehavior, setBatchBehavior] = useState('idle');
  const [availableScripts, setAvailableScripts] = useState<readonly BotScript[]>(() => [
    ...SCRIPT_PRESETS,
    ...loadLocalScripts().filter((script) => !SCRIPT_PRESETS.some((preset) => preset.id === script.id)),
  ]);
  const [batchScriptId, setBatchScriptId] = useState<string>(SCRIPT_PRESETS[0]?.id ?? '');
  const showToast = useDialogStore((s) => s.showToast);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchServers(); }, [fetchServers]);
  useEffect(() => { setFilter({ serverId: serverId || undefined, search: search || undefined }); }, [serverId, search, setFilter]);
  useEffect(() => { fetchBots(); }, [filter, fetchBots]);
  useEffect(() => { fetchStats(serverId || undefined); }, [serverId, fetchStats]);

  // Auto-poll every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBots();
      fetchStats(serverId || undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchBots, fetchStats, serverId]);

  // Load saved configs
  useEffect(() => {
    botApi.listSavedConfigs(serverId || undefined)
      .then((res) => setSavedConfigs(res.data))
      .catch(() => {});
  }, [serverId]);

  const reloadScripts = useCallback(() => {
    setAvailableScripts([
      ...SCRIPT_PRESETS,
      ...loadLocalScripts().filter((script) => !SCRIPT_PRESETS.some((preset) => preset.id === script.id)),
    ]);
  }, []);

  useEffect(() => {
    if (availableScripts.length > 0 && !availableScripts.some((script) => script.id === batchScriptId)) {
      setBatchScriptId(availableScripts[0]!.id);
    }
  }, [availableScripts, batchScriptId]);

  const handleRefresh = useCallback(() => {
    fetchBots();
    fetchStats(serverId || undefined);
    botApi.listSavedConfigs(serverId || undefined)
      .then((res) => setSavedConfigs(res.data))
      .catch(() => {});
  }, [fetchBots, fetchStats, serverId]);

  const handleStop = useCallback(async (name: string) => {
    await stopBot(name);
    fetchStats(serverId || undefined);
  }, [stopBot, fetchStats, serverId]);

  const handleConsole = useCallback((name: string) => {
    navigate(`/bots/${encodeURIComponent(name)}/console`);
  }, [navigate]);

  const handleToggleSelect = useCallback((name: string) => {
    setSelectedBots((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedBots((prev) =>
      prev.size === bots.length ? new Set() : new Set(bots.map((b) => b.name)),
    );
  }, [bots]);

  const handleBatchStop = useCallback(async () => {
    if (selectedBots.size === 0) return;
    try {
      await botApi.batchStop([...selectedBots]);
      showToast(`已停止 ${selectedBots.size} 个机器人`, 'success');
      setSelectedBots(new Set());
      fetchBots();
    } catch { showToast('批量停止失败', 'error'); }
  }, [selectedBots, showToast, fetchBots]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedBots.size === 0) return;
    const confirmed = await useDialogStore.getState().confirm({
      title: '批量删除机器人',
      message: `确定删除选中的 ${selectedBots.size} 个机器人？这会停止并从当前列表移除这些机器人。`,
      confirmLabel: '批量删除',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await botApi.batchDelete([...selectedBots]);
      showToast(`已删除 ${selectedBots.size} 个机器人`, 'success');
      setSelectedBots(new Set());
      fetchBots();
      fetchStats(serverId || undefined);
    } catch {
      showToast('批量删除失败', 'error');
    }
  }, [selectedBots, showToast, fetchBots, fetchStats, serverId]);

  const handleBatchReconnect = useCallback(async () => {
    if (selectedBots.size === 0) return;
    try {
      await botApi.batchReconnect([...selectedBots]);
      showToast(`已发送重连指令 (${selectedBots.size})`, 'success');
    } catch { showToast('批量重连失败', 'error'); }
  }, [selectedBots, showToast]);

  const handleBatchBehavior = useCallback(async () => {
    if (selectedBots.size === 0) return;
    try {
      await botApi.batchBehavior([...selectedBots], batchBehavior);
      showToast(`已切换行为: ${batchBehavior} (${selectedBots.size})`, 'success');
    } catch { showToast('批量切换失败', 'error'); }
  }, [selectedBots, batchBehavior, showToast]);

  const handleBatchScript = useCallback(async () => {
    if (selectedBots.size === 0) return;
    const script = availableScripts.find((item) => item.id === batchScriptId);
    if (!script) {
      showToast('请先选择一个可执行脚本', 'error');
      return;
    }
    try {
      await botApi.batchExecuteScript([...selectedBots], script);
      showToast(`已向 ${selectedBots.size} 个机器人下发脚本：${script.name}`, 'success');
    } catch {
      showToast('批量执行脚本失败', 'error');
    }
  }, [selectedBots, availableScripts, batchScriptId, showToast]);

  const handleDeleteSavedConfig = useCallback(async (id: string) => {
    try {
      await botApi.deleteSavedConfig(id);
      setSavedConfigs((prev) => prev.filter((c) => c.id !== id));
      showToast('配置已删除', 'success');
    } catch { showToast('删除失败', 'error'); }
  }, [showToast]);

  const handleExportConfigs = useCallback(() => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      configs: savedConfigs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jianagent-configs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${savedConfigs.length} 个配置`, 'success');
  }, [savedConfigs, showToast]);

  const handleImportConfigs = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.configs || !Array.isArray(data.configs)) {
        showToast('无效的配置文件格式', 'error');
        return;
      }
      let imported = 0;
      for (const cfg of data.configs) {
        try {
          await botApi.createSavedConfig({
            serverId: cfg.serverId ?? serverId,
            namePrefix: cfg.namePrefix,
            count: cfg.count,
            behavior: cfg.behavior,
            autoCreate: cfg.autoCreate ?? false,
            rejoinStrategy: cfg.rejoinStrategy ?? 'none',
            maxRetries: cfg.maxRetries ?? 3,
          });
          imported++;
        } catch { /* skip duplicates */ }
      }
      showToast(`已导入 ${imported} 个配置`, 'success');
      const res = await botApi.listSavedConfigs(serverId || undefined);
      setSavedConfigs(res.data);
    } catch {
      showToast('导入失败：文件格式错误', 'error');
    }
    // Reset input
    if (importRef.current) importRef.current.value = '';
  }, [serverId, showToast]);

  const availableServers = servers.filter(
    (s) => s.runtimeStatus === 'running' || s.serverType === 'external',
  );

  return (
    <div className="p-6 space-y-4">
      {/* 顶栏 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm p-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mr-2">机器人控制台</h1>
          <button
            type="button"
            onClick={() => navigate('/bots/scripts')}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 active:scale-95 transition-all duration-150"
          >
            脚本编辑器
          </button>
          <button
            type="button"
            onClick={reloadScripts}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 active:scale-95 transition-all duration-150"
          >
            重载脚本
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            disabled={!serverId}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 active:scale-95 transition-all duration-150 font-medium shadow-sm"
          >
            + 创建批次
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await stopAll();
                useDialogStore.getState().showToast('全部机器人已停止', 'success');
              } catch (err: any) {
                useDialogStore.getState().showToast(err.message ?? '停止失败', 'error');
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg px-4 py-2 active:scale-95 transition-all duration-150 font-medium shadow-sm"
          >
            全部停止
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 rounded-lg px-3 py-2 active:scale-95 transition-all duration-150 backdrop-blur-md shadow-sm font-medium"
          >
            刷新
          </button>
          <div className="flex border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 rounded-lg overflow-hidden backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-sm transition-colors font-medium ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-slate-800/50'}`}
            >
              卡片
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm transition-colors font-medium ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-slate-800/50'}`}
            >
              表格
            </button>
          </div>
        </div>
      </div>

      {/* 筛选 + 统计 */}
      <div className="flex flex-wrap items-center gap-4">
        <StyledSelect
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
        >
          <option value="">全部服务器</option>
          {availableServers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.serverType === 'external' ? ' (外置)' : ''}
            </option>
          ))}
        </StyledSelect>

        <input
          type="text"
          placeholder="搜索机器人..."
          className="border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-300 backdrop-blur-md shadow-sm transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <BotStatsBar stats={stats} />
      </div>

      {/* 批量操作栏 */}
      {selectedBots.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-xl px-4 py-2 shadow-sm backdrop-blur-md">
          <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
            已选择 {selectedBots.size} 个
          </span>
          <button type="button" onClick={handleSelectAll}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
            {selectedBots.size === bots.length ? '取消全选' : '全选'}
          </button>
          <div className="flex-1" />
          <StyledSelect value={batchBehavior} onChange={(e) => setBatchBehavior(e.target.value)} className="text-xs">
            <option value="idle">idle</option>
            <option value="walk_random">walk_random</option>
            <option value="chat_spam">chat_spam</option>
            <option value="pvp_attack">pvp_attack</option>
            <option value="gather">gather</option>
            <option value="jump">jump</option>
          </StyledSelect>
          <button type="button" onClick={handleBatchBehavior}
            className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:scale-95 transition-all duration-150 font-medium shadow-sm">
            切换行为
          </button>
          <button type="button" onClick={handleBatchReconnect}
            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all duration-150 font-medium shadow-sm">
            批量重连
          </button>
          <StyledSelect value={batchScriptId} onChange={(e) => setBatchScriptId(e.target.value)} className="text-xs min-w-[180px]">
            {availableScripts.map((script) => (
              <option key={script.id} value={script.id}>
                {script.name}
              </option>
            ))}
          </StyledSelect>
          <button type="button" onClick={handleBatchScript}
            className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 active:scale-95 transition-all duration-150 font-medium shadow-sm">
            批量执行脚本
          </button>
          <button type="button" onClick={handleBatchStop}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all duration-150 font-medium shadow-sm">
            批量停止
          </button>
          <button type="button" onClick={handleBatchDelete}
            className="px-3 py-1.5 text-xs bg-rose-700 text-white rounded-lg hover:bg-rose-800 active:scale-95 transition-all duration-150 font-medium shadow-sm">
            批量删除
          </button>
          <button type="button" onClick={() => setSelectedBots(new Set())}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium">
            取消
          </button>
        </div>
      )}

      {/* 保存的配置 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            已保存的配置 {savedConfigs.length > 0 && `(${savedConfigs.length})`}
          </h3>
          <div className="flex items-center gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImportConfigs}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="text-[10px] px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              导入配置
            </button>
            {savedConfigs.length > 0 && (
              <button
                type="button"
                onClick={handleExportConfigs}
                className="text-[10px] px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                导出配置
              </button>
            )}
          </div>
        </div>
        {savedConfigs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {savedConfigs.map((cfg) => (
              <div key={cfg.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded px-3 py-1.5 text-xs">
                <span className="text-gray-700 dark:text-gray-200">{cfg.namePrefix} × {cfg.count}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500 dark:text-gray-400">{cfg.behavior}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500 dark:text-gray-400">{cfg.rejoinStrategy}</span>
                <button type="button"
                  onClick={() => handleDeleteSavedConfig(cfg.id)}
                  className="text-red-400 hover:text-red-300 ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">暂无已保存配置，可通过导入或创建批次时保存</p>
        )}
      </div>

      {/* 游戏聊天面板 */}
      <BotChatPanel />

      {/* 内容 */}
      {loading && bots.length === 0 && <div className="text-center text-gray-500 dark:text-gray-400 py-8">加载中...</div>}
      {error && !loading && <ErrorState message={error} onRetry={handleRefresh} />}
      {!error && bots.length === 0 && !loading && (
        <EmptyState
          title="暂无机器人"
          description={serverId ? '该服务器还没有机器人，点击上方按钮创建' : '请先选择一个运行中的服务器'}
        />
      )}
      {!error && bots.length > 0 && (
        <>
          {viewMode === 'card' ? (
            <BotCardGrid bots={bots} onStop={handleStop} onSelect={selectBot} onConsole={handleConsole}
              selectedBots={selectedBots} onToggleSelect={handleToggleSelect} />
          ) : (
            <BotTable bots={bots} onStop={handleStop} onSelect={selectBot} onConsole={handleConsole}
              selectedBots={selectedBots} onToggleSelect={handleToggleSelect} />
          )}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setFilter({ page: meta.page - 1 })}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {meta.page} / {Math.ceil(meta.total / meta.limit)}
              </span>
              <button
                type="button"
                disabled={meta.page * meta.limit >= meta.total}
                onClick={() => setFilter({ page: meta.page + 1 })}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 创建抽屉 */}
      <CreateBotDrawer
        serverId={serverId}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); handleRefresh(); }}
      />
    </div>
  );
}

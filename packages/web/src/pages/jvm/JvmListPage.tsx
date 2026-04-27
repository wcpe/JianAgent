import React, { useState, useEffect, useCallback, FormEvent, useRef } from 'react';
import { Search, RotateCw, Zap, Loader2 } from 'lucide-react';
import JvmProcessCard from './components/JvmProcessCard';
import { jvmApi } from '../../api/jvm.api';
import type { JvmProcessDetail, JvmQueryParams } from '../../types/jvm.types';
import { useDialogStore } from '../../stores/dialog.store.js';

const REFRESH_OPTIONS = [
  { value: '0', label: '冻结（不自动刷新）' },
  { value: '5', label: '每 5 秒' },
  { value: '10', label: '每 10 秒' },
  { value: '30', label: '每 30 秒' },
] as const;

const JvmListPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allData, setAllData] = useState<JvmProcessDetail[]>([]);
  const [data, setData] = useState<JvmProcessDetail[]>([]);
  const [formData, setFormData] = useState<JvmQueryParams>({
    name: '',
    mainClass: '',
    user: '',
  });
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState<string>('5');
  const filterRef = useRef<JvmQueryParams>(formData);
  const showToast = useDialogStore((state) => state.showToast);

  const filterData = useCallback((processes: JvmProcessDetail[], params: JvmQueryParams) => {
    const filtered = processes.filter((process) => {
      const matchName = !params.name || process.name?.toLowerCase().includes(params.name.toLowerCase());
      const matchMainClass = !params.mainClass || process.mainClass?.toLowerCase().includes(params.mainClass.toLowerCase());
      const matchUser = !params.user || process.user?.toLowerCase().includes(params.user.toLowerCase());
      return matchName && matchMainClass && matchUser;
    });
    // 确保过滤后的数据也按 PID 排序
    return filtered.sort((a, b) => a.pid - b.pid);
  }, []);

  const fetchData = useCallback(async (mode: 'initial' | 'manual' | 'auto' = 'manual') => {
    if (mode === 'initial') {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const processes = await jvmApi.listProcesses();
      const visibleProcesses = processes.filter(
        (p) => !p.command.includes('java-helper-1.0.0.jar'),
      );
      const detailedProcesses: JvmProcessDetail[] = visibleProcesses.map((p) => ({
        pid: p.pid,
        name: p.name ?? p.mainClass ?? p.command,
        mainClass: p.mainClass ?? p.name,
        javaVersion: undefined,
        jvmVersion: undefined,
        startTime: p.startTime,
        uptime: p.uptimeSec ?? 0,
        user: p.user,
        commandLine: p.command,
      }));
      // 按 PID 排序，确保顺序稳定
      detailedProcesses.sort((a, b) => a.pid - b.pid);
      setAllData(detailedProcesses);
      setData(filterData(detailedProcesses, filterRef.current));
    } catch (error: any) {
      if (mode !== 'auto') {
        showToast(error?.message ?? '获取 JVM 进程列表失败', 'error');
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [filterData, showToast]);

  useEffect(() => {
    filterRef.current = formData;
    setData(filterData(allData, formData));
  }, [allData, formData, filterData]);

  useEffect(() => {
    void fetchData('initial');
    const intervalMs = Number.parseInt(refreshIntervalSeconds, 10) * 1000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }
    const interval = setInterval(() => {
      void fetchData('auto');
    }, intervalMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalSeconds]);

  // 创建稳定的刷新回调，避免每次渲染都创建新函数
  const handleRefresh = useCallback(() => {
    void fetchData('auto');
  }, [fetchData]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setData(filterData(allData, formData));
  };

  const handleReset = () => {
    const resetParams = { name: '', mainClass: '', user: '' };
    setFormData(resetParams);
    setData(filterData(allData, resetParams));
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">JVM 进程监控</span>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">进程名称</label>
              <input
                type="text"
                placeholder="请输入进程名称"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-52 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">主类</label>
              <input
                type="text"
                placeholder="请输入主类名"
                value={formData.mainClass}
                onChange={(e) => setFormData({ ...formData, mainClass: e.target.value })}
                className="w-52 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">用户</label>
              <input
                type="text"
                placeholder="请输入用户名"
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={refreshIntervalSeconds}
                onChange={(e) => setRefreshIntervalSeconds(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="刷新间隔"
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void fetchData('manual')}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                立即刷新
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                查询
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
                重置
              </button>
            </div>
          </form>
          {refreshing ? (
            <div className="mt-3 text-xs text-gray-500">正在后台刷新数据...</div>
          ) : null}
        </div>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Zap className="w-16 h-16 mb-4" />
            <p className="text-lg">暂无 JVM 进程</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((process) => (
            <JvmProcessCard
              key={process.pid}
              process={process}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JvmListPage;

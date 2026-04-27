import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Search, RotateCw, Network, Loader2 } from 'lucide-react';
import { portApi } from '../../api/port.api';
import type { PortUsage } from '../../types/port.types';
import { useDialogStore } from '../../stores/dialog.store.js';

const REFRESH_OPTIONS = [
  { value: '0', label: '冻结（不自动刷新）' },
  { value: '5', label: '每 5 秒' },
  { value: '10', label: '每 10 秒' },
  { value: '30', label: '每 30 秒' },
] as const;

const PortListPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<PortUsage[]>([]);
  const [filteredData, setFilteredData] = useState<PortUsage[]>([]);
  const [formData, setFormData] = useState({
    port: '',
    protocol: '',
    processName: '',
  });
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState<string>('5');
  const showToast = useDialogStore((state) => state.showToast);
  const [selectedPortDetail, setSelectedPortDetail] = useState<PortUsage | null>(null);

  const applyFilter = useCallback((source: PortUsage[], query: typeof formData): PortUsage[] => {
    return source.filter((item) => {
      const portMatch = !query.port || item.port.toString().includes(query.port);
      const protocolMatch = !query.protocol || item.protocol.toLowerCase().includes(query.protocol.toLowerCase());
      const processMatch = !query.processName || (item.processName ?? '').toLowerCase().includes(query.processName.toLowerCase());
      return portMatch && protocolMatch && processMatch;
    });
  }, []);

  const fetchData = useCallback(async (mode: 'initial' | 'manual' | 'auto' = 'manual') => {
    if (mode === 'initial') {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const ports = await portApi.getAllPorts();
      setData(ports);
      setFilteredData((prev) => {
        if (mode === 'initial') {
          return applyFilter(ports, formData);
        }
        return prev.length === 0 && !formData.port && !formData.protocol && !formData.processName
          ? ports
          : applyFilter(ports, formData);
      });
      if (selectedPortDetail) {
        const latest = ports.find((entry) => entry.port === selectedPortDetail.port) ?? null;
        setSelectedPortDetail(latest);
      }
    } catch (error: any) {
      if (mode !== 'auto') {
        showToast(error?.message ?? '获取端口使用情况失败', 'error');
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [applyFilter, formData, selectedPortDetail, showToast]);

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

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setFilteredData(applyFilter(data, formData));
  };

  const handleReset = () => {
    const reset = { port: '', protocol: '', processName: '' };
    setFormData(reset);
    setFilteredData(data);
  };

  const handleLoadPortDetail = async (port: number) => {
    try {
      const detail = await portApi.getPortUsage(port);
      setSelectedPortDetail(detail);
      if (!detail) {
        showToast(`端口 ${port} 未找到详情`, 'info');
      }
    } catch (error: any) {
      showToast(error?.message ?? '查询端口详情失败', 'error');
    }
  };

  const handleClosePort = async (port: number) => {
    if (!window.confirm(`确认关闭端口 ${port} 对应进程吗？`)) {
      return;
    }
    try {
      const result = await portApi.closePort(port);
      showToast(`端口 ${port} 关闭完成（处理 ${result.closed}/${result.attempted} 个进程）`, 'success');
      await fetchData('manual');
    } catch (error: any) {
      showToast(error?.message ?? '关闭端口失败', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">端口管理</span>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">端口号</label>
              <input
                type="text"
                placeholder="请输入端口号"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                className="w-52 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">协议</label>
              <input
                type="text"
                placeholder="TCP/UDP"
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">进程名称</label>
              <input
                type="text"
                placeholder="请输入进程名称"
                value={formData.processName}
                onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
                className="w-52 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={refreshIntervalSeconds}
                onChange={(e) => setRefreshIntervalSeconds(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
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
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
              >
                <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                立即刷新
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Search className="w-4 h-4" />
                查询
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
                重置
              </button>
            </div>
          </form>
          {refreshing ? (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">正在后台刷新数据...</div>
          ) : null}
        </div>
      </div>

      {selectedPortDetail ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">端口详情：{selectedPortDetail.port}</p>
            <button
              type="button"
              onClick={() => setSelectedPortDetail(null)}
              className="text-xs text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
            >
              关闭
            </button>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-blue-900 dark:text-blue-100">
            <div>协议：{selectedPortDetail.protocol}</div>
            <div>PID：{selectedPortDetail.pid}</div>
            <div>进程：{selectedPortDetail.processName ?? '-'}</div>
            <div>状态：{selectedPortDetail.status ?? 'UNKNOWN'}</div>
            <div>主机：{selectedPortDetail.hostname ?? '-'}</div>
            <div>命令：{selectedPortDetail.commandLine ?? '-'}</div>
            <div>采集时间：{selectedPortDetail.timestamp ? new Date(selectedPortDetail.timestamp).toLocaleString('zh-CN') : '-'}</div>
          </div>
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {initialLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12">
            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <Network className="w-16 h-16 mb-4" />
              <p className="text-lg">暂无端口数据</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">端口</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">协议</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">进程名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">主机</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map((item, index) => (
                  <tr key={`${item.pid}-${item.port}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.port}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.protocol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{item.processName ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.pid}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'LISTEN'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {item.status ?? 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.hostname ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleLoadPortDetail(item.port)}
                          className="px-2.5 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleClosePort(item.port)}
                          className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          关闭端口
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortListPage;

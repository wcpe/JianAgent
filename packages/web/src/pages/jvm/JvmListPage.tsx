import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Search, RotateCw, Zap, Loader2 } from 'lucide-react';
import JvmProcessCard from './components/JvmProcessCard';
import { jvmApi } from '../../api/jvm.api';
import type { JvmProcessDetail, JvmQueryParams } from '../../types/jvm.types';

const JvmListPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<JvmProcessDetail[]>([]);
  const [data, setData] = useState<JvmProcessDetail[]>([]);
  const [formData, setFormData] = useState<JvmQueryParams>({
    name: '',
    mainClass: '',
    user: '',
  });

  const filterData = useCallback((processes: JvmProcessDetail[], params: JvmQueryParams) => {
    return processes.filter((process) => {
      const matchName = !params.name || process.name?.toLowerCase().includes(params.name.toLowerCase());
      const matchMainClass = !params.mainClass || process.mainClass?.toLowerCase().includes(params.mainClass.toLowerCase());
      const matchUser = !params.user || process.user?.toLowerCase().includes(params.user.toLowerCase());
      return matchName && matchMainClass && matchUser;
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const processes = await jvmApi.listProcesses();
      const detailedProcesses: JvmProcessDetail[] = processes.map((p) => ({
        pid: p.pid,
        name: p.command,
        mainClass: p.command,
        javaVersion: '',
        jvmVersion: '',
        startTime: '',
        uptime: 0,
        user: '',
        commandLine: p.command,
      }));
      setAllData(detailedProcesses);
      setData(filterData(detailedProcesses, formData));
    } catch (error) {
      console.error('获取 JVM 进程列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [formData, filterData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
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
        </div>
      </div>

      {loading ? (
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
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JvmListPage;

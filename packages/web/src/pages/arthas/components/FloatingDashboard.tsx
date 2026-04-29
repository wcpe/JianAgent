import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, X, Maximize2, Minimize2, Cpu, MemoryStick, Zap, Clock } from 'lucide-react';
import { arthasApi } from '../../../api/arthas.api.js';

interface DashboardMetrics {
  threadCount: number;
  peakThreadCount: number;
  daemonThreadCount: number;
  heapUsed: number;
  heapMax: number;
  nonHeapUsed: number;
  nonHeapMax: number;
  gcCount: number;
  gcTime: number;
  cpuUsage: number;
  systemLoad: number;
  uptime: number;
}

interface FloatingDashboardProps {
  serverId: string | null;
  isConnected: boolean;
}

export function FloatingDashboard({ serverId, isConnected }: FloatingDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!serverId || !isConnected) return;

    try {
      setIsLoading(true);
      const result = await arthasApi.executeCommand(serverId, 'dashboard -n 1');
      
      if (result.success && result.output) {
        // 确保 output 是字符串
        let outputStr: string;
        if (typeof result.output === 'string') {
          outputStr = result.output;
        } else if (typeof result.output === 'object') {
          outputStr = JSON.stringify(result.output);
        } else {
          outputStr = String(result.output);
        }
        
        // 解析 dashboard 输出
        const parsed = parseDashboardOutput(outputStr);
        setMetrics(parsed);
      } else if (result.error?.includes('not attached') || result.error?.includes('ECONNREFUSED')) {
        // 连接已断开，停止轮询
        console.warn('FloatingDashboard: Arthas 连接已断开，停止轮询');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setMetrics(null);
      }
    } catch (err) {
      // 网络错误不中断轮询，只清除加载状态
      console.warn('FloatingDashboard: 获取数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [serverId, isConnected]);

  useEffect(() => {
    if (isExpanded && isConnected && serverId) {
      // 立即获取一次数据
      fetchDashboardData();
      
      // 每 2 秒刷新一次
      intervalRef.current = setInterval(fetchDashboardData, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isExpanded, isConnected, serverId, fetchDashboardData]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-green-400';
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="fixed right-6 top-24 z-50">
      {!isExpanded ? (
        // 收起状态 - 小图标按钮
        <button
          onClick={() => setIsExpanded(true)}
          className="group relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title="打开实时监控"
        >
          <Activity className="w-6 h-6 text-white animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
        </button>
      ) : (
        // 展开状态 - 完整面板
        <div className="w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">实时监控</span>
              {isLoading && (
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="收起"
              >
                <Minimize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
            {!metrics ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                <p>正在加载监控数据...</p>
              </div>
            ) : (
              <>
                {/* 线程信息 */}
                <MetricCard
                  icon={<Zap className="w-4 h-4" />}
                  title="线程"
                  color="cyan"
                >
                  <MetricRow label="总数" value={metrics.threadCount.toString()} />
                  <MetricRow label="峰值" value={metrics.peakThreadCount.toString()} />
                  <MetricRow label="守护" value={metrics.daemonThreadCount.toString()} />
                </MetricCard>

                {/* 堆内存 */}
                <MetricCard
                  icon={<MemoryStick className="w-4 h-4" />}
                  title="堆内存"
                  color="blue"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">已用</span>
                      <span className={getUsageColor((metrics.heapUsed / metrics.heapMax) * 100)}>
                        {formatBytes(metrics.heapUsed)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">最大</span>
                      <span className="text-gray-300">{formatBytes(metrics.heapMax)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (metrics.heapUsed / metrics.heapMax) * 100 >= 90
                            ? 'bg-red-500'
                            : (metrics.heapUsed / metrics.heapMax) * 100 >= 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((metrics.heapUsed / metrics.heapMax) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      {((metrics.heapUsed / metrics.heapMax) * 100).toFixed(1)}%
                    </div>
                  </div>
                </MetricCard>

                {/* 非堆内存 */}
                <MetricCard
                  icon={<MemoryStick className="w-4 h-4" />}
                  title="非堆内存"
                  color="purple"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">已用</span>
                      <span className="text-gray-300">{formatBytes(metrics.nonHeapUsed)}</span>
                    </div>
                    {metrics.nonHeapMax > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">最大</span>
                          <span className="text-gray-300">{formatBytes(metrics.nonHeapMax)}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                          <div
                            className="h-2 rounded-full bg-purple-500 transition-all duration-500"
                            style={{ width: `${Math.min((metrics.nonHeapUsed / metrics.nonHeapMax) * 100, 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </MetricCard>

                {/* GC 统计 */}
                <MetricCard
                  icon={<Cpu className="w-4 h-4" />}
                  title="GC 统计"
                  color="green"
                >
                  <MetricRow label="次数" value={metrics.gcCount.toString()} />
                  <MetricRow label="耗时" value={`${metrics.gcTime}ms`} />
                </MetricCard>

                {/* 系统信息 */}
                <MetricCard
                  icon={<Clock className="w-4 h-4" />}
                  title="系统"
                  color="orange"
                >
                  <MetricRow label="CPU" value={`${metrics.cpuUsage.toFixed(1)}%`} />
                  <MetricRow label="负载" value={metrics.systemLoad.toFixed(2)} />
                  <MetricRow label="运行时间" value={formatUptime(metrics.uptime)} />
                </MetricCard>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700 text-xs text-gray-500 text-center">
            每 2 秒自动刷新
          </div>
        </div>
      )}
    </div>
  );
}

// 辅助组件
interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  color: 'cyan' | 'blue' | 'purple' | 'green' | 'orange';
  children: React.ReactNode;
}

function MetricCard({ icon, title, color, children }: MetricCardProps) {
  const colorClasses = {
    cyan: 'text-cyan-400 bg-cyan-900/20 border-cyan-700/30',
    blue: 'text-blue-400 bg-blue-900/20 border-blue-700/30',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-700/30',
    green: 'text-green-400 bg-green-900/20 border-green-700/30',
    orange: 'text-orange-400 bg-orange-900/20 border-orange-700/30',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={colorClasses[color].split(' ')[0]}>{icon}</div>
        <span className="text-xs font-medium text-gray-200">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-mono">{value}</span>
    </div>
  );
}

// 解析 dashboard 输出
function parseDashboardOutput(output: string): DashboardMetrics {
  const metrics: DashboardMetrics = {
    threadCount: 0,
    peakThreadCount: 0,
    daemonThreadCount: 0,
    heapUsed: 0,
    heapMax: 0,
    nonHeapUsed: 0,
    nonHeapMax: 0,
    gcCount: 0,
    gcTime: 0,
    cpuUsage: 0,
    systemLoad: 0,
    uptime: 0,
  };

  try {
    // 解析线程信息
    const threadMatch = output.match(/thread-count:\s*(\d+)/i);
    if (threadMatch) metrics.threadCount = parseInt(threadMatch[1]);

    const peakThreadMatch = output.match(/peak-thread-count:\s*(\d+)/i);
    if (peakThreadMatch) metrics.peakThreadCount = parseInt(peakThreadMatch[1]);

    const daemonThreadMatch = output.match(/daemon-thread-count:\s*(\d+)/i);
    if (daemonThreadMatch) metrics.daemonThreadCount = parseInt(daemonThreadMatch[1]);

    // 解析堆内存 (支持多种单位)
    const heapUsedMatch = output.match(/heap-memory-usage.*?used:\s*([\d.]+)([KMG]?)/i);
    if (heapUsedMatch) {
      metrics.heapUsed = parseMemoryValue(heapUsedMatch[1], heapUsedMatch[2]);
    }

    const heapMaxMatch = output.match(/heap-memory-usage.*?max:\s*([\d.]+)([KMG]?)/i);
    if (heapMaxMatch) {
      metrics.heapMax = parseMemoryValue(heapMaxMatch[1], heapMaxMatch[2]);
    }

    // 解析非堆内存
    const nonHeapUsedMatch = output.match(/non-heap-memory-usage.*?used:\s*([\d.]+)([KMG]?)/i);
    if (nonHeapUsedMatch) {
      metrics.nonHeapUsed = parseMemoryValue(nonHeapUsedMatch[1], nonHeapUsedMatch[2]);
    }

    const nonHeapMaxMatch = output.match(/non-heap-memory-usage.*?max:\s*([\d.]+)([KMG]?)/i);
    if (nonHeapMaxMatch) {
      metrics.nonHeapMax = parseMemoryValue(nonHeapMaxMatch[1], nonHeapMaxMatch[2]);
    }

    // 解析 GC 信息
    const gcCountMatch = output.match(/gc-count:\s*(\d+)/i);
    if (gcCountMatch) metrics.gcCount = parseInt(gcCountMatch[1]);

    const gcTimeMatch = output.match(/gc-time:\s*(\d+)/i);
    if (gcTimeMatch) metrics.gcTime = parseInt(gcTimeMatch[1]);

    // 解析 CPU 和系统负载
    const cpuMatch = output.match(/cpu:\s*([\d.]+)%/i);
    if (cpuMatch) metrics.cpuUsage = parseFloat(cpuMatch[1]);

    const loadMatch = output.match(/system-load:\s*([\d.]+)/i);
    if (loadMatch) metrics.systemLoad = parseFloat(loadMatch[1]);

    // 解析运行时间
    const uptimeMatch = output.match(/uptime:\s*(\d+)/i);
    if (uptimeMatch) metrics.uptime = parseInt(uptimeMatch[1]) * 1000; // 转换为毫秒
  } catch (err) {
    console.error('Failed to parse dashboard output:', err);
  }

  return metrics;
}

function parseMemoryValue(value: string, unit: string): number {
  const num = parseFloat(value);
  switch (unit.toUpperCase()) {
    case 'K':
      return num * 1024;
    case 'M':
      return num * 1024 * 1024;
    case 'G':
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

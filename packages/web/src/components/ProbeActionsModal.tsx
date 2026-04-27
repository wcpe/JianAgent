import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Activity, FileText, HardDrive, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { jvmApi } from '../api/jvm.api';
import { useDialogStore } from '../stores/dialog.store';
import { formatBytes } from '../utils/format';

interface ProbeActionsModalProps {
  open: boolean;
  onClose: () => void;
  pid: number;
  processName: string;
  heapSample?: any;
  threadSample?: any;
}

type TabType = 'info' | 'thread-dump' | 'heap-dump';

export function ProbeActionsModal({ 
  open, 
  onClose, 
  pid, 
  processName,
  heapSample,
  threadSample 
}: ProbeActionsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(false);
  const [threadDumpLoading, setThreadDumpLoading] = useState(false);
  const [heapDumpLoading, setHeapDumpLoading] = useState(false);
  const [diskSpace, setDiskSpace] = useState<any>(null);
  const [heapEstimate, setHeapEstimate] = useState<any>(null);
  const [dumps, setDumps] = useState<any[]>([]);
  const showToast = useDialogStore((state) => state.showToast);

  useEffect(() => {
    if (open && activeTab === 'heap-dump') {
      loadHeapDumpInfo();
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (open) {
      loadDumps();
    }
  }, [open]);

  const loadHeapDumpInfo = async () => {
    try {
      const dumpsDir = '/tmp/jianagent-dumps';
      const [spaceResult, estimateResult] = await Promise.all([
        jvmApi.checkDiskSpace(dumpsDir),
        jvmApi.estimateHeapSize(),
      ]);
      setDiskSpace(spaceResult.data);
      setHeapEstimate(estimateResult.data);
    } catch (error: any) {
      console.error('Failed to load heap dump info', error);
    }
  };

  const loadDumps = async () => {
    try {
      const result = await jvmApi.listDumps();
      setDumps(result);
    } catch (error: any) {
      console.error('Failed to load dumps', error);
    }
  };

  const handleGenerateThreadDump = async () => {
    setThreadDumpLoading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `thread-dump-${pid}-${timestamp}.txt`;
      const outputPath = `/tmp/jianagent-dumps/${filename}`;
      
      const result = await jvmApi.generateThreadDump(outputPath);
      
      if (result.data?.success) {
        showToast(`线程转储已生成：${filename}`, 'success');
        await loadDumps();
      } else {
        showToast(result.data?.error || '生成线程转储失败', 'error');
      }
    } catch (error: any) {
      showToast(error?.message || '生成线程转储失败', 'error');
    } finally {
      setThreadDumpLoading(false);
    }
  };

  const handleGenerateHeapDump = async () => {
    setHeapDumpLoading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `heap-dump-${pid}-${timestamp}.hprof`;
      const outputPath = `/tmp/jianagent-dumps/${filename}`;
      
      showToast('正在生成堆转储，这可能需要几分钟...', 'info');
      
      const result = await jvmApi.generateHeapDump(outputPath);
      
      if (result.data?.success) {
        showToast(`堆转储已生成：${filename} (${formatBytes(result.data.fileSizeBytes)})`, 'success');
        await loadDumps();
      } else {
        showToast(result.data?.error || '生成堆转储失败', 'error');
      }
    } catch (error: any) {
      showToast(error?.message || '生成堆转储失败', 'error');
    } finally {
      setHeapDumpLoading(false);
    }
  };

  const handleDownloadDump = (filename: string) => {
    jvmApi.downloadDump(filename);
  };

  const renderInfoTab = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">探针已附加</h3>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          进程：{processName} (PID: {pid})
        </p>
      </div>

      {heapSample && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">堆内存使用</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">已使用</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatBytes(heapSample.data?.heapUsage?.used || 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">最大值</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatBytes(heapSample.data?.heapUsage?.max || 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">使用率</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {heapSample.data?.heapUsage?.usagePercent?.toFixed(1) || 0}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">已提交</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatBytes(heapSample.data?.heapUsage?.committed || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {threadSample && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">线程信息</h4>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            线程总数：<span className="font-semibold">{threadSample.data?.threadCount || 0}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderThreadDumpTab = () => (
    <div className="space-y-4">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">线程转储</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              生成当前所有线程的堆栈跟踪快照，用于诊断死锁、线程阻塞等问题。
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerateThreadDump}
        disabled={threadDumpLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {threadDumpLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            生成线程转储
          </>
        )}
      </button>

      {dumps.filter(d => d.type === 'thread').length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">已生成的线程转储</h4>
          <div className="space-y-2">
            {dumps.filter(d => d.type === 'thread').map((dump) => (
              <div key={dump.filename} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {dump.filename}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(dump.size)} • {new Date(dump.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadDump(dump.filename)}
                  className="ml-2 p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderHeapDumpTab = () => (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">堆转储</h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              生成完整的堆内存快照（.hprof 文件），用于分析内存泄漏和对象分布。
              <strong className="block mt-1">警告：生成过程可能影响应用性能，文件可能非常大。</strong>
            </p>
          </div>
        </div>
      </div>

      {heapEstimate && diskSpace && (
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">预估文件大小</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatBytes(heapEstimate.estimatedBytes)}
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">可用磁盘空间</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatBytes(diskSpace.availableBytes)}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleGenerateHeapDump}
        disabled={heapDumpLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {heapDumpLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            生成中（可能需要几分钟）...
          </>
        ) : (
          <>
            <HardDrive className="w-5 h-5" />
            生成堆转储
          </>
        )}
      </button>

      {dumps.filter(d => d.type === 'heap').length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">已生成的堆转储</h4>
          <div className="space-y-2">
            {dumps.filter(d => d.type === 'heap').map((dump) => (
              <div key={dump.filename} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {dump.filename}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(dump.size)} • {new Date(dump.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadDump(dump.filename)}
                  className="ml-2 p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="探针操作"
      subtitle={`${processName} (PID: ${pid})`}
      size="lg"
    >
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 -mx-6 px-6">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          基础信息
        </button>
        <button
          onClick={() => setActiveTab('thread-dump')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'thread-dump'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          线程转储
        </button>
        <button
          onClick={() => setActiveTab('heap-dump')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'heap-dump'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          堆转储
        </button>
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'thread-dump' && renderThreadDumpTab()}
        {activeTab === 'heap-dump' && renderHeapDumpTab()}
      </div>
    </Modal>
  );
}

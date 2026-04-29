import React from 'react';
import { FileText, AlertCircle } from 'lucide-react';

interface LoggerInfo {
  name?: string;
  clazz?: string;
  classLoader?: string;
  classLoaderHash?: string;
  level?: string;
  effectiveLevel?: string;
  additivity?: boolean;
  codeSource?: string;
  appenders?: Array<{
    name?: string;
    clazz?: string;
    target?: string;
    file?: string;
  }>;
}

interface LoggerData {
  loggers?: LoggerInfo[];
  name?: string;
  logger?: LoggerInfo;
}

interface LoggerWidgetProps {
  readonly data: unknown;
}

const levelColors: Record<string, string> = {
  TRACE: 'text-gray-400',
  DEBUG: 'text-blue-400',
  INFO: 'text-green-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  FATAL: 'text-red-600',
};

export function LoggerWidget({ data }: LoggerWidgetProps) {
  const loggerData = data as LoggerData;
  const loggers = loggerData?.loggers ?? [];
  const singleLogger = loggerData?.logger;

  // Single logger view
  if (singleLogger) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-gray-200">日志管理</span>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Logger 名称</div>
            <div className="text-sm text-blue-300 font-mono break-all">{singleLogger.name}</div>
          </div>

          {singleLogger.clazz && (
            <div>
              <div className="text-xs text-gray-400 mb-1">实现类</div>
              <div className="text-xs text-gray-300 break-all">{singleLogger.clazz}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {singleLogger.level && (
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-xs text-gray-400">级别</div>
                <div className={`text-sm font-semibold ${levelColors[singleLogger.level] || 'text-white'}`}>
                  {singleLogger.level}
                </div>
              </div>
            )}
            {singleLogger.effectiveLevel && (
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-xs text-gray-400">有效级别</div>
                <div className={`text-sm font-semibold ${levelColors[singleLogger.effectiveLevel] || 'text-white'}`}>
                  {singleLogger.effectiveLevel}
                </div>
              </div>
            )}
          </div>

          {singleLogger.appenders && singleLogger.appenders.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2">Appenders</div>
              <div className="space-y-2">
                {singleLogger.appenders.map((appender, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded p-2">
                    <div className="text-xs text-gray-300 mb-1">{appender.name}</div>
                    <div className="text-xs text-gray-500">{appender.clazz}</div>
                    {appender.file && (
                      <div className="text-xs text-cyan-300 mt-1 break-all">{appender.file}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // All loggers view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-gray-200">日志管理</span>
        </div>
        <span className="text-xs text-gray-400">{loggers.length} 个 Logger</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loggers.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
            <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">无 Logger 信息</p>
          </div>
        ) : (
          loggers.map((logger, idx) => (
            <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm text-blue-300 font-mono break-all flex-1">
                  {logger.name || `Logger ${idx + 1}`}
                </div>
                {logger.level && (
                  <span className={`text-xs px-2 py-0.5 rounded bg-gray-800 ml-2 ${levelColors[logger.level] || 'text-white'}`}>
                    {logger.level}
                  </span>
                )}
              </div>

              {logger.clazz && (
                <div className="text-xs text-gray-400 mb-1">{logger.clazz}</div>
              )}

              {logger.effectiveLevel && logger.effectiveLevel !== logger.level && (
                <div className="text-xs text-gray-500">
                  有效级别: <span className={levelColors[logger.effectiveLevel] || 'text-white'}>
                    {logger.effectiveLevel}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
        <div className="text-xs text-gray-500">
          提示: 使用 <code className="text-cyan-300 bg-gray-950/50 px-1 rounded">logger -n &lt;name&gt; -l &lt;level&gt;</code> 修改日志级别
        </div>
      </div>
    </div>
  );
}

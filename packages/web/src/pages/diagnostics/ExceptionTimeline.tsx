import { type FC, useState, useMemo, useCallback } from 'react';
import type { ExceptionEventDto } from '@jian-agent/shared-domain';

interface Props {
  readonly events: readonly ExceptionEventDto[];
}

type ColorClass = 'bg-red-500' | 'bg-yellow-500' | 'bg-gray-400';

function getExceptionColor(exceptionClass: string): ColorClass {
  if (
    exceptionClass.includes('RuntimeException') ||
    exceptionClass.includes('NullPointerException') ||
    exceptionClass.includes('IllegalStateException') ||
    exceptionClass.includes('IllegalArgumentException') ||
    exceptionClass.includes('Error')
  ) {
    return 'bg-red-500';
  }
  if (
    exceptionClass.includes('IOException') ||
    exceptionClass.includes('TimeoutException') ||
    exceptionClass.includes('SocketException')
  ) {
    return 'bg-yellow-500';
  }
  return 'bg-gray-400';
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shortClassName(fullClass: string): string {
  const parts = fullClass.split('.');
  return parts[parts.length - 1] ?? fullClass;
}

const ExceptionTimeline: FC<Props> = ({ events }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const aggregation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.exceptionClass, (counts.get(event.exceptionClass) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  const handleToggle = useCallback((index: number) => {
    setExpandedId((prev) => (prev === index ? null : index));
  }, []);

  if (events.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        暂无异常事件，请先开始异常监控
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregation badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from(aggregation.entries()).map(([exClass, count]) => (
          <span
            key={exClass}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-white ${getExceptionColor(exClass)}`}
          >
            {shortClassName(exClass)}
            <span className="bg-white/20 rounded-full px-1.5">{count}</span>
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {events.map((event, index) => {
          const color = getExceptionColor(event.exceptionClass);
          const isExpanded = expandedId === index;

          return (
            <div key={index} className="relative pl-10 pb-4">
              {/* Timeline dot */}
              <div
                className={`absolute left-3 top-1.5 w-3 h-3 rounded-full border-2 border-white ${color}`}
              />

              <button
                type="button"
                className="w-full text-left hover:bg-gray-50 rounded p-2 transition-colors"
                onClick={() => handleToggle(index)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 tabular-nums">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="text-sm font-medium">
                    {shortClassName(event.exceptionClass)}
                  </span>
                  <span className="text-xs text-gray-400">{event.threadName}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-1 p-3 bg-gray-50 rounded border text-xs space-y-2">
                  {event.message && (
                    <div>
                      <span className="text-gray-500">消息: </span>
                      <span className="text-red-600">{event.message}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">完整类名: </span>
                    <span className="font-mono">{event.exceptionClass}</span>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">调用栈:</div>
                    <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {event.stackTrace.join('\n')}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExceptionTimeline;

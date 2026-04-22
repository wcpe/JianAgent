import { type FC, useState, useCallback } from 'react';
import type { MethodHotspot } from '@jian-agent/shared-domain';

interface Props {
  readonly hotspots: readonly MethodHotspot[];
  readonly onSelect?: (hotspot: MethodHotspot) => void;
}

const PERCENTAGE_COLORS = [
  { min: 20, bg: 'bg-red-500' },
  { min: 10, bg: 'bg-orange-400' },
  { min: 5, bg: 'bg-yellow-400' },
  { min: 0, bg: 'bg-blue-400' },
] as const;

function getBarColor(percentage: number): string {
  for (const range of PERCENTAGE_COLORS) {
    if (percentage >= range.min) return range.bg;
  }
  return 'bg-blue-400';
}

function truncateClassName(fullName: string, maxLen = 40): string {
  if (fullName.length <= maxLen) return fullName;
  const parts = fullName.split('.');
  if (parts.length <= 2) return fullName.slice(-maxLen);
  return `...${parts.slice(-2).join('.')}`;
}

const MethodHotspotChart: FC<Props> = ({ hotspots, onSelect }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleClick = useCallback(
    (hotspot: MethodHotspot, index: number) => {
      setExpandedIndex((prev) => (prev === index ? null : index));
      onSelect?.(hotspot);
    },
    [onSelect],
  );

  if (hotspots.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        暂无热点数据，请先开始 Profiling
      </div>
    );
  }

  const maxPercentage = Math.max(...hotspots.map((h) => h.percentage), 1);

  return (
    <div className="space-y-1">
      {hotspots.map((hotspot, index) => {
        const barWidth = (hotspot.percentage / maxPercentage) * 100;
        const isExpanded = expandedIndex === index;

        return (
          <div key={`${hotspot.className}.${hotspot.methodName}`}>
            <button
              type="button"
              className="w-full text-left hover:bg-gray-50 rounded p-2 transition-colors"
              onClick={() => handleClick(hotspot, index)}
            >
              <div className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-500 text-right tabular-nums">
                  {hotspot.percentage.toFixed(1)}% ({hotspot.samples})
                </div>
                <div className="flex-1 relative">
                  <div
                    className={`h-5 rounded ${getBarColor(hotspot.percentage)} opacity-80 transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-xs font-mono truncate">
                      {truncateClassName(hotspot.className)}.
                      <span className="font-semibold">{hotspot.methodName}</span>
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {isExpanded && hotspot.callerChain.length > 0 && (
              <div className="ml-36 pl-4 border-l-2 border-gray-200 py-1 mb-2">
                <div className="text-xs text-gray-500 mb-1">调用链（Top callers）:</div>
                {hotspot.callerChain.map((caller, ci) => (
                  <div key={ci} className="text-xs font-mono text-gray-600 py-0.5">
                    ← {caller}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MethodHotspotChart;

interface PhaseEntry {
  readonly phase: string;
  readonly botCount: number;
  readonly behavior: string;
  readonly startedAt?: string;
  readonly finishedAt?: string | null;
  readonly durationMs?: number | null;
}

interface Props {
  readonly phases: readonly PhaseEntry[];
  readonly currentPhase: string | null;
}

export function PhaseTimeline({ phases, currentPhase }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">阶段时间线</h3>
      {phases.length === 0 && <p className="text-gray-400 text-sm">暂无阶段记录</p>}
      <div className="space-y-1">
        {phases.map((p, i) => {
          const isCurrent = p.phase === currentPhase;
          const isCompleted = p.finishedAt != null;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                isCurrent ? 'bg-blue-100 border border-blue-300' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-500' : isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="font-medium">{p.phase}</span>
              <span className="text-gray-500">{p.botCount} bots</span>
              <span className="text-gray-500">{p.behavior}</span>
              {p.durationMs != null && (
                <span className="ml-auto text-gray-400">{(p.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

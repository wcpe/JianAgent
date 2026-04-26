import { type FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { DebugRecordingDto, DebugRecordingEventDto } from '@jian-agent/shared-domain';
import { terminalApi } from '../../api/terminal.api.js';

interface Props {
  readonly recordingId: string;
  readonly onClose?: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;

const DebugReplayPanel: FC<Props> = ({ recordingId, onClose }) => {
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<readonly DebugRecordingEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playIndexRef = useRef(0);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch events on mount / recordingId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    terminalApi
      .getRecordingEvents(recordingId)
      .then((data) => {
        if (!cancelled) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  // Initialize xterm
  useEffect(() => {
    let term: Terminal | null = null;
    const loadTerminal = async () => {
      try {
        const { Terminal } = await import('@xterm/xterm');
        term = new Terminal({
          disableStdin: true,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
          theme: {
            background: '#1e1e2e',
            foreground: '#cdd6f4',
          },
        });
        if (termRef.current) {
          term.open(termRef.current);
          termInstance.current = term;
        }
      } catch {
        // xterm not available in test
      }
    };
    void loadTerminal();
    return () => {
      term?.dispose();
      termInstance.current = null;
    };
  }, []);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (events.length === 0) return;
    setPlaying(true);

    const tick = () => {
      const idx = playIndexRef.current;
      if (idx >= events.length) {
        setPlaying(false);
        return;
      }

      const event = events[idx];
      if (event.eventType === 'output' && termInstance.current) {
        termInstance.current.write(event.data);
      }

      playIndexRef.current = idx + 1;
      setProgress(((idx + 1) / events.length) * 100);

      const nextEvent = events[idx + 1];
      if (nextEvent) {
        const delay = Math.min((nextEvent.offsetMs - event.offsetMs) / speed, 1000);
        playTimerRef.current = setTimeout(tick, Math.max(delay, 1));
      } else {
        setPlaying(false);
      }
    };

    tick();
  }, [events, speed]);

  const handleReset = useCallback(() => {
    stopPlayback();
    playIndexRef.current = 0;
    setProgress(0);
    termInstance.current?.clear();
  }, [stopPlayback]);

  const totalDurationMs = useMemo(() => {
    if (events.length === 0) return 0;
    return events[events.length - 1].offsetMs;
  }, [events]);

  if (loading) {
    return <div className="text-gray-400 text-sm py-4 text-center">加载录制数据…</div>;
  }

  if (error) {
    return <div className="text-danger-500 text-sm py-4 text-center">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-gray-900">
      {/* Controls bar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <button
          type="button"
          onClick={playing ? stopPlayback : play}
          className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
        >
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1 text-sm rounded bg-gray-600 hover:bg-gray-500 text-white"
        >
          ⏹ 重置
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>速度:</span>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded ${
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {events.length} 事件 · {(totalDurationMs / 1000).toFixed(1)}s
        </span>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Terminal viewport */}
      <div ref={termRef} className="flex-1 min-h-[300px]" />
    </div>
  );
};

export default DebugReplayPanel;

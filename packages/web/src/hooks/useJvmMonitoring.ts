import { useEffect, useRef, useState, useCallback } from 'react';

export interface MemorySnapshot {
  used: number;
  max: number;
  committed: number;
  usagePercent: number;
  pools: {
    eden?: { used: number; max: number; committed: number; usagePercent: number };
    survivor?: { used: number; max: number; committed: number; usagePercent: number };
    oldGen?: { used: number; max: number; committed: number; usagePercent: number };
  };
  nonHeap: {
    used: number;
    pools: {
      metaspace?: { used: number; max: number; committed: number; usagePercent: number };
      codeCache?: { used: number; max: number; committed: number; usagePercent: number };
    };
  };
}

export interface ThreadSnapshot {
  totalThreads: number;
  daemonThreads: number;
  peakThreads: number;
  stateDistribution: {
    RUNNABLE: number;
    WAITING: number;
    TIMED_WAITING: number;
    BLOCKED: number;
  };
  deadlockedThreads: string[];
  topCpuThreads: Array<{
    id: number;
    name: string;
    cpuTimeMs: number;
    state: string;
  }>;
}

export interface GcSnapshot {
  collectors: Array<{
    name: string;
    collectionCount: number;
    collectionTimeMs: number;
  }>;
  totalCollections: number;
  totalCollectionTimeMs: number;
}

export interface MonitoringSnapshot {
  type: 'monitoring-snapshot';
  timestamp: number;
  memory: MemorySnapshot;
  threads: ThreadSnapshot;
  gc: GcSnapshot;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseJvmMonitoringOptions {
  pid: string;
  interval?: number;
  maxDataPoints?: number;
  autoConnect?: boolean;
}

export interface UseJvmMonitoringResult {
  connectionState: ConnectionState;
  snapshots: MonitoringSnapshot[];
  latestSnapshot: MonitoringSnapshot | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  setInterval: (interval: number) => void;
}

export function useJvmMonitoring({
  pid,
  interval = 5,
  maxDataPoints = 100,
  autoConnect = true,
}: UseJvmMonitoringOptions): UseJvmMonitoringResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [snapshots, setSnapshots] = useState<MonitoringSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentIntervalRef = useRef(interval);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState('connecting');
    setError(null);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/monitoring`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnectionState('connected');
      // Subscribe to monitoring
      ws.send(JSON.stringify({
        event: 'subscribe-monitoring',
        data: { pid, interval: currentIntervalRef.current },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'monitoring-snapshot':
            setSnapshots((prev) => {
              const updated = [...prev, message as MonitoringSnapshot];
              // Keep only the last maxDataPoints
              return updated.slice(-maxDataPoints);
            });
            break;
          
          case 'monitoring-started':
            console.log('Monitoring started:', message);
            break;
          
          case 'monitoring-stopped':
            console.log('Monitoring stopped:', message);
            setConnectionState('disconnected');
            break;
          
          case 'monitoring-error':
            setError(message.message || 'Monitoring error');
            setConnectionState('error');
            break;
          
          case 'monitoring-replaced':
            console.warn('Monitoring session replaced by another connection');
            break;
          
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('WebSocket connection error');
      setConnectionState('error');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [pid, maxDataPoints]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send unsubscribe message
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          event: 'unsubscribe-monitoring',
          data: { pid },
        }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
    setSnapshots([]);
  }, [pid]);

  const setIntervalValue = useCallback((newInterval: number) => {
    currentIntervalRef.current = newInterval;
    // If connected, reconnect with new interval
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
      setTimeout(() => connect(), 100);
    }
  }, [connect, disconnect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return {
    connectionState,
    snapshots,
    latestSnapshot,
    error,
    connect,
    disconnect,
    setInterval: setIntervalValue,
  };
}

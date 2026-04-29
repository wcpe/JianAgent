import { useState, useEffect, useCallback, useRef } from 'react';
import { arthasApi, type ArthasStatus } from '../../../api/arthas.api.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface ArthasConnectionHook {
  readonly state: ConnectionState;
  readonly serverId: string | null;
  readonly status: ArthasStatus | null;
  readonly error: string | null;
  attach: (pid: number) => Promise<string>;
  detach: () => Promise<void>;
  sendCommand: (command: string) => Promise<string>;
  clearError: () => void;
}

export function useArthasConnection(): ArthasConnectionHook {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [serverId, setServerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ArthasStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 3;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stopStatusPolling = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, []);

  const onDetectedDisconnect = useCallback((reason: string) => {
    setState('disconnected');
    setServerId(null);
    setStatus(null);
    stopStatusPolling();
    setError(reason);
  }, [stopStatusPolling]);

  const startStatusPolling = useCallback((sid: string) => {
    stopStatusPolling();
    reconnectAttemptRef.current = 0;

    const poll = async () => {
      try {
        const st = await arthasApi.getStatus(sid);
        setStatus(st);

        // 健康检查失败或进程已断开
        if (st.healthCheckFailed || !st.attached) {
          onDetectedDisconnect(
            st.healthCheckFailed
              ? 'Arthas 进程已异常退出（健康检查失败）'
              : 'Arthas 连接已断开',
          );
          return;
        }

        // 成功获取状态，重置重连计数
        reconnectAttemptRef.current = 0;
      } catch (err: any) {
        // 轮询出错，尝试重连
        reconnectAttemptRef.current++;
        if (reconnectAttemptRef.current >= maxReconnectAttempts) {
          onDetectedDisconnect(
            `Arthas 连接丢失（连续 ${maxReconnectAttempts} 次轮询失败）`,
          );
        } else {
          setError(`状态轮询失败，尝试重连 (${reconnectAttemptRef.current}/${maxReconnectAttempts}): ${err?.message ?? '未知错误'}`);
          setState('reconnecting');
        }
      }
    };

    // 立即执行一次，然后每 3 秒轮询
    poll();
    statusIntervalRef.current = setInterval(poll, 3000);
  }, [stopStatusPolling, onDetectedDisconnect]);

  const attach = useCallback(async (pid: number): Promise<string> => {
    setState('connecting');
    setError(null);
    reconnectAttemptRef.current = 0;

    try {
      const result = await arthasApi.attach({ pid });
      if (!result.success) {
        throw new Error(result.error ?? 'Attach 失败');
      }

      setServerId(result.serverId);
      setState('connected');
      startStatusPolling(result.serverId);
      return result.serverId;
    } catch (err: any) {
      setState('error');
      setError(err?.message ?? 'Attach 失败');
      throw err;
    }
  }, [startStatusPolling]);

  const detach = useCallback(async () => {
    if (!serverId) return;

    try {
      await arthasApi.detach(serverId);
      setState('disconnected');
      setServerId(null);
      setStatus(null);
      stopStatusPolling();
    } catch (err: any) {
      setError(err?.message ?? 'Detach 失败');
      throw err;
    }
  }, [serverId, stopStatusPolling]);

  const sendCommand = useCallback(async (command: string): Promise<string> => {
    if (!serverId) {
      throw new Error('未连接到 Arthas 服务器');
    }

    try {
      const result = await arthasApi.executeCommand(serverId, command);
      if (!result.success) {
        // 检查是否因为连接断开导致的失败
        if (result.error?.includes('not attached') || result.error?.includes('ECONNREFUSED')) {
          onDetectedDisconnect(`命令执行失败，连接已断开: ${result.error}`);
        }
        throw new Error(result.error ?? '命令执行失败');
      }

      const output = result.output;
      if (typeof output === 'string') {
        return output;
      }
      if (output == null) {
        return '';
      }
      if (typeof output === 'object') {
        return JSON.stringify(output, null, 2);
      }
      return String(output);
    } catch (err: any) {
      setError(err?.message ?? '命令执行失败');
      throw err;
    }
  }, [serverId, onDetectedDisconnect]);

  useEffect(() => {
    return () => {
      stopStatusPolling();
    };
  }, [stopStatusPolling]);

  return {
    state,
    serverId,
    status,
    error,
    attach,
    detach,
    sendCommand,
    clearError,
  };
}

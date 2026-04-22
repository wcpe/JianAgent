import { useEffect } from 'react';
import type { WsMessage } from '@jian-agent/shared-protocol';
import { wsClient } from './ws-client.js';
import { wsMultiplexer } from './ws-multiplexer.js';

type ChannelCallback<T = unknown> = (payload: T, msg: WsMessage<T>) => void;

export function useWsChannel<T = unknown>(
  channel: string,
  callback: ChannelCallback<T>,
  sessionId?: string,
): void {
  useEffect(() => {
    wsClient.connect();
    const unsub = wsMultiplexer.subscribe<T>(channel, callback, sessionId);
    return unsub;
  }, [channel, callback, sessionId]);
}

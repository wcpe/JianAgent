import type { WsMessage } from '@jian-agent/shared-protocol';
import { wsClient } from './ws-client.js';

type ChannelListener<T = unknown> = (payload: T, msg: WsMessage<T>) => void;

class WsMultiplexer {
  private readonly channelListeners = new Map<string, Set<ChannelListener<any>>>();

  constructor() {
    wsClient.addListener((msg) => this.handleMessage(msg));
  }

  subscribe<T = unknown>(
    channel: string,
    listener: ChannelListener<T>,
    sessionId?: string,
  ): () => void {
    const key = this.makeKey(channel, sessionId);
    let set = this.channelListeners.get(key);
    if (!set) {
      set = new Set();
      this.channelListeners.set(key, set);
    }
    set.add(listener as ChannelListener<any>);

    return () => {
      set!.delete(listener as ChannelListener<any>);
      if (set!.size === 0) {
        this.channelListeners.delete(key);
      }
    };
  }

  private handleMessage(msg: WsMessage): void {
    const channel = msg.channel;
    const sessionId = msg.sessionId;

    // Try exact match with sessionId first
    if (sessionId) {
      const exactKey = this.makeKey(channel, sessionId);
      const exactSet = this.channelListeners.get(exactKey);
      if (exactSet) {
        for (const listener of exactSet) {
          listener(msg.payload, msg);
        }
      }
    }

    // Always also notify channel-only listeners
    const channelKey = this.makeKey(channel);
    const channelSet = this.channelListeners.get(channelKey);
    if (channelSet) {
      for (const listener of channelSet) {
        listener(msg.payload, msg);
      }
    }
  }

  private makeKey(channel: string, sessionId?: string): string {
    return sessionId ? `${channel}:${sessionId}` : channel;
  }
}

export const wsMultiplexer = new WsMultiplexer();

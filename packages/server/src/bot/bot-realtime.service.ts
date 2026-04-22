import { Injectable } from '@nestjs/common';
import type { BotEventPush } from '@jian-agent/shared-protocol';
import { WsChannel } from '@jian-agent/shared-protocol';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

/** Sliding window entry for chat deduplication */
interface ChatDedupEntry {
  readonly message: string;
  readonly firstBot: string;
  readonly timestamp: number;
  viewers: number;
}

export interface BotRealtimeChatMessage {
  readonly botName: string;
  readonly message: string;
  readonly timestamp: number;
  readonly serverId?: string;
  readonly batchId?: string;
  readonly validationRunId?: string;
}

export interface BotChatQuery {
  readonly botName?: string;
  readonly serverId?: string;
  readonly batchId?: string;
  readonly validationRunId?: string;
  readonly sinceTimestamp?: number;
  readonly limit?: number;
}

/** How long (ms) identical messages are considered duplicates */
const CHAT_DEDUP_WINDOW_MS = 1_500;
/** Max entries in the dedup buffer */
const CHAT_DEDUP_MAX_ENTRIES = 200;
/** Max retained bot events in memory */
const BOT_EVENT_BUFFER_MAX_ENTRIES = 500;
/** Max retained chat messages in memory */
const CHAT_BUFFER_MAX_ENTRIES = 500;

export interface BotRealtimeEvent extends BotEventPush {
  readonly serverId?: string;
  readonly batchId?: string;
  readonly validationRunId?: string;
}

export interface BotEventQuery {
  readonly botName?: string;
  readonly serverId?: string;
  readonly batchId?: string;
  readonly validationRunId?: string;
  readonly sinceTimestamp?: number;
  readonly limit?: number;
}

@Injectable()
export class BotRealtimeService {
  private readonly chatDedupBuffer: ChatDedupEntry[] = [];
  private readonly botEventBuffer: BotRealtimeEvent[] = [];
  private readonly chatBuffer: BotRealtimeChatMessage[] = [];

  constructor(private readonly gateway: RealtimeGateway) {}

  pushBotState(bots: ReadonlyArray<{ name: string; state: string; behavior: string | null }>): void {
    this.gateway.broadcastChannel(WsChannel.RESOURCE_BOT_STATE, { bots, timestamp: new Date().toISOString() });
  }

  pushBotEvent(event: BotRealtimeEvent): void {
    this.botEventBuffer.push({ ...event });
    while (this.botEventBuffer.length > BOT_EVENT_BUFFER_MAX_ENTRIES) {
      this.botEventBuffer.shift();
    }

    this.gateway.broadcastChannel(WsChannel.TASK_BOT_EVENT, event);
  }

  getRecentBotEvents(query: BotEventQuery = {}): readonly BotRealtimeEvent[] {
    const limit = Math.max(1, Math.min(query.limit ?? 50, BOT_EVENT_BUFFER_MAX_ENTRIES));
    const events = this.botEventBuffer.filter((event) => {
      if (query.botName && event.botName !== query.botName) return false;
      if (query.serverId && event.serverId !== query.serverId) return false;
      if (query.batchId && event.batchId !== query.batchId) return false;
      if (query.validationRunId && event.validationRunId !== query.validationRunId) return false;
      if (query.sinceTimestamp && event.timestamp < query.sinceTimestamp) return false;
      return true;
    });

    return events.slice(-limit).reverse();
  }

  getRecentChatMessages(query: BotChatQuery = {}): readonly BotRealtimeChatMessage[] {
    const limit = Math.max(1, Math.min(query.limit ?? 50, CHAT_BUFFER_MAX_ENTRIES));
    const messages = this.chatBuffer.filter((entry) => {
      if (query.botName && entry.botName !== query.botName) return false;
      if (query.serverId && entry.serverId !== query.serverId) return false;
      if (query.batchId && entry.batchId !== query.batchId) return false;
      if (query.validationRunId && entry.validationRunId !== query.validationRunId) return false;
      if (query.sinceTimestamp && entry.timestamp < query.sinceTimestamp) return false;
      return true;
    });

    return messages.slice(-limit).reverse();
  }

  pushSessionState(sessionId: string, state: string, currentPhase: string | null): void {
    this.gateway.broadcastChannel(WsChannel.RESOURCE_SESSION_STATE, { sessionId, state, currentPhase, timestamp: new Date().toISOString() });
  }

  pushSessionPhase(sessionId: string, phase: string, botCount: number, behavior: string): void {
    this.gateway.broadcastChannel(WsChannel.TASK_SESSION_PHASE, { sessionId, phase, botCount, behavior, timestamp: new Date().toISOString() });
  }

  pushDebugOutput(botName: string, output: string): void {
    this.gateway.broadcastChannel(`terminal-session:bot-debug:output:${botName}` as any, { data: output });
  }

  pushChatMessage(message: BotRealtimeChatMessage): void {
    // Prune expired entries
    const cutoff = Date.now() - CHAT_DEDUP_WINDOW_MS;
    while (this.chatDedupBuffer.length > 0 && this.chatDedupBuffer[0].timestamp < cutoff) {
      this.chatDedupBuffer.shift();
    }

    // Check for duplicate
    const existing = this.chatDedupBuffer.find(
      (e) => e.message === message.message && e.timestamp >= cutoff,
    );
    if (existing) {
      existing.viewers += 1;
      // Do not broadcast — it's a duplicate from another bot seeing the same message
      return;
    }

    // New unique message — record and broadcast
    this.chatDedupBuffer.push({ message: message.message, firstBot: message.botName, timestamp: Date.now(), viewers: 1 });
    if (this.chatDedupBuffer.length > CHAT_DEDUP_MAX_ENTRIES) {
      this.chatDedupBuffer.shift();
    }
    this.chatBuffer.push({ ...message });
    while (this.chatBuffer.length > CHAT_BUFFER_MAX_ENTRIES) {
      this.chatBuffer.shift();
    }

    this.gateway.broadcastChannel(WsChannel.TERMINAL_SESSION_BOT_CHAT, {
      botName: message.botName,
      message: message.message,
      timestamp: message.timestamp,
    });
  }
}

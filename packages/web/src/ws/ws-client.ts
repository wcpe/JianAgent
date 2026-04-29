import type { WsMessage } from '@jian-agent/shared-protocol';

export type WsListener = (msg: WsMessage) => void;

class WsClient {
  private static readonly MAX_PENDING = 1000;
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<WsListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly maxReconnectDelay = 30_000;
  private intentionalClose = false;
  private connectionFailed = false;
  private pendingMessages: unknown[] = [];

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Don't try to connect without a token
    const token = sessionStorage.getItem('token');
    if (!token) {
      return;
    }

    this.intentionalClose = false;
    this.connectionFailed = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = `?token=${encodeURIComponent(token)}`;
    const url = `${protocol}//${location.host}/ws/realtime${query}`;

    const ws = new WebSocket(url);
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        this.scheduleReconnect();
      }
    }, 5000); // 5 second timeout

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      this.reconnectAttempts = 0;
      // Send queued messages
      const msgs = this.pendingMessages;
      this.pendingMessages = [];
      for (const msg of msgs) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        for (const listener of this.listeners) {
          listener(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      clearTimeout(connectionTimeout);
      this.ws = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      clearTimeout(connectionTimeout);
      // onclose will fire after onerror
    };

    this.ws = ws;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.pendingMessages = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get reconnecting(): boolean {
    return this.reconnectTimer !== null;
  }

  get failed(): boolean {
    return this.connectionFailed;
  }

  send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      if (this.pendingMessages.length >= WsClient.MAX_PENDING) {
        this.pendingMessages.shift();
      }
      this.pendingMessages.push(message);
    }
  }

  addListener(listener: WsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionFailed = true;
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new WsClient();

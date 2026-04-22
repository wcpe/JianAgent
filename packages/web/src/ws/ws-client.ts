import type { WsMessage } from '@jian-agent/shared-protocol';

export type WsListener = (msg: WsMessage) => void;

class WsClient {
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

    this.intentionalClose = false;
    this.connectionFailed = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${protocol}//${location.host}/ws/realtime${query}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
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
      this.ws = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
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

import mineflayer from 'mineflayer';
import type { Bot } from 'mineflayer';
import { BotState } from '@jian-agent/shared-domain';
import type { BotInstanceInfo } from '../registry/bot-instance.js';
import type { BotRegistry } from '../registry/bot-registry.js';
import { ReconnectStrategy } from './reconnect-strategy.js';
import { BotHealthChecker } from './bot-health.js';

export interface ConnectOptions {
  readonly serverHost: string;
  readonly serverPort: number;
  readonly serverVersion?: string;
  readonly connectTimeoutMs: number;
  readonly reconnectEnabled: boolean;
  readonly reconnectMaxRetries: number;
  readonly autoRespawn: boolean;
}

export class BotConnector {
  private readonly reconnectStrategies = new Map<string, ReconnectStrategy>();
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Track recent death timestamps per bot for rapid-death detection */
  private readonly deathTimestamps = new Map<string, number[]>();
  /** Bots whose auto-respawn has been suspended due to rapid death */
  private readonly autoRespawnSuspended = new Set<string>();
  /** Store connect options per bot for force-respawn reconnection */
  private readonly connectOptionsMap = new Map<string, ConnectOptions>();
  /** Track bots that were in DEBUGGING state before disconnect for auto-restore */
  private readonly wasDebugging = new Set<string>();

  /** Max deaths within the window before suspending auto-respawn */
  private static readonly RAPID_DEATH_MAX = 4;
  /** Time window (ms) to count deaths */
  private static readonly RAPID_DEATH_WINDOW_MS = 60_000;
  /** Cooldown (ms) after rapid-death suspension before attempting recovery reconnect */
  private static readonly RAPID_DEATH_RECOVERY_MS = 90_000;

  constructor(
    private readonly registry: BotRegistry,
    private readonly healthChecker: BotHealthChecker,
    private readonly onEvent: (botName: string, event: string, message: string) => void,
    private readonly onChatMessage?: (botName: string, message: string) => void,
  ) {}

  async connect(name: string, options: ConnectOptions): Promise<void> {
    // Store options for force-respawn reconnection
    this.connectOptionsMap.set(name, options);
    // Clean up any existing connection before reconnecting
    const existing = this.registry.get(name);
    if (existing?.bot) {
      // Mark as STOPPED to prevent the 'end' event from triggering another reconnect
      existing.state = BotState.STOPPED;
      try {
        existing.bot.removeAllListeners();
        // Also remove listeners from underlying protocol client to prevent stray ECONNRESET crashes
        if ((existing.bot as any)._client) {
          (existing.bot as any)._client.removeAllListeners();
        }
        existing.bot.quit();
      } catch { /* ignore */ }
    }
    this.clearReconnectTimer(name);

    // Do NOT reset death tracking here — it must persist across reconnects
    // so rapid-death detection works. Only reset on explicit disconnect().

    const bot = mineflayer.createBot({
      host: options.serverHost,
      port: options.serverPort,
      username: name,
      auth: 'offline',
      hideErrors: true,
      ...(options.serverVersion ? { version: options.serverVersion } : {}),
    });

    // Enable TCP keepalive on the underlying socket to detect dead connections
    const enableKeepalive = () => {
      const socket = (bot as any)._client?.socket;
      if (socket?.setKeepAlive) {
        socket.setKeepAlive(true, 15_000);
      }
    };
    const client = (bot as any)._client;
    if (client?.socket) {
      enableKeepalive();
    } else if (client) {
      client.once('connect', enableKeepalive);
    }

    // Preserve deathCount across reconnects
    const previousInfo = this.registry.get(name);
    const previousDeathCount = previousInfo?.deathCount ?? 0;

    const info: BotInstanceInfo = {
      name,
      state: BotState.CONNECTING,
      bot,
      currentBehavior: null,
      connectedAt: null,
      lastError: null,
      lastDisconnectReason: null,
      deathCount: previousDeathCount,
    };
    this.registry.add(info);

    if (options.reconnectEnabled) {
      this.reconnectStrategies.set(
        name,
        new ReconnectStrategy(options.reconnectMaxRetries, 1000, 30000, 2),
      );
    }

    this.setupListeners(name, bot, options);
  }

  disconnect(name: string): void {
    this.clearReconnectTimer(name);
    this.reconnectStrategies.delete(name);
    this.deathTimestamps.delete(name);
    this.autoRespawnSuspended.delete(name);
    this.connectOptionsMap.delete(name);
    this.wasDebugging.delete(name);
    const info = this.registry.get(name);
    if (info?.bot) {
      try {
        info.bot.removeAllListeners();
        if ((info.bot as any)._client) {
          (info.bot as any)._client.removeAllListeners();
        }
        info.bot.quit();
      } catch { /* ignore */ }
      info.state = BotState.STOPPED;
    }
    this.healthChecker.remove(name);
  }

  disconnectAll(): void {
    for (const name of this.registry.names()) {
      this.disconnect(name);
    }
  }

  /** Manual respawn: clears rapid-death suspension and reconnects the bot */
  forceRespawn(name: string): void {
    this.autoRespawnSuspended.delete(name);
    this.deathTimestamps.delete(name);
    const info = this.registry.get(name);
    if (!info) return;
    // If bot is connected and alive enough to send in-game respawn, do it
    const botAlive = info.bot && (info.bot as any)._client?.socket?.writable;
    if (botAlive) {
      try {
        info.state = BotState.SPAWNED;
        info.bot!.respawn();
        this.onEvent(name, 'FORCE_RESPAWN', `${name} force-respawned in-game`);
        return;
      } catch { /* fall through to reconnect */ }
    }
    // Connection lost — reconnect from scratch
    const options = this.connectOptionsMap.get(name);
    if (options) {
      this.onEvent(name, 'FORCE_RESPAWN', `${name} force-reconnecting after manual respawn`);
      this.connect(name, options);
    }
  }

  private setupListeners(name: string, bot: Bot, options: ConnectOptions): void {
    bot.once('spawn', () => {
      const info = this.registry.get(name);
      if (info) {
        // Restore DEBUGGING state if bot was debugging before disconnect
        if (this.wasDebugging.has(name)) {
          info.state = BotState.DEBUGGING;
          this.wasDebugging.delete(name);
          this.onEvent(name, 'DEBUG_RESTORED', `${name} reconnected — debug mode restored`);
        } else {
          info.state = BotState.SPAWNED;
        }
        info.connectedAt = new Date().toISOString();
        this.healthChecker.recordHeartbeat(name);
        this.reconnectStrategies.get(name)?.reset();
        this.onEvent(name, 'SPAWNED', `${name} spawned`);
      }
    });

    bot.on('health', () => {
      this.healthChecker.recordHeartbeat(name);
      // Detect death early: when health drops to 0, set DEAD and start recovery
      // This is the canonical death detector — it fires before 'death' and 'end' events
      const info = this.registry.get(name);
      if (info && bot.health <= 0 && info.state !== BotState.DEAD && info.state !== BotState.STOPPED) {
        // Preserve DEBUGGING state for auto-restore after respawn
        if (info.state === BotState.DEBUGGING) {
          this.wasDebugging.add(name);
        }
        info.state = BotState.DEAD;
        info.deathCount += 1;
        this.onEvent(name, 'DIED', `${name} died (health=0)`);
        this.handleDeathRecovery(name, options);
      }
    });

    bot.on('kicked', (reason) => {
      const info = this.registry.get(name);
      if (!info) return;
      info.lastDisconnectReason = typeof reason === 'string' ? reason : JSON.stringify(reason);
      // If bot is already DEAD or STOPPED, let the death/stop handler manage recovery
      if (info.state === BotState.DEAD || info.state === BotState.STOPPED) {
        this.onEvent(name, 'KICKED', `${name} kicked while ${info.state}: ${info.lastDisconnectReason}`);
        return;
      }
      // Preserve DEBUGGING state for auto-restore after reconnect
      if (info.state === BotState.DEBUGGING) {
        this.wasDebugging.add(name);
      }
      info.state = BotState.DISCONNECTED;
      this.onEvent(name, 'KICKED', `${name} kicked: ${info.lastDisconnectReason}`);
      this.attemptReconnect(name, options);
    });

    bot.on('end', (reason) => {
      // Capture position before bot object is cleaned up — use NaN as sentinel
      const lastY = bot.entity?.position?.y ?? NaN;
      // Delay processing to let 'death' event fire first (race condition: end may fire before death)
      setTimeout(() => {
        const info = this.registry.get(name);
        // Skip if already stopped, disconnected, or dead (death has its own handler)
        if (info && info.state !== BotState.STOPPED && info.state !== BotState.DISCONNECTED && info.state !== BotState.DEAD) {
          // Preserve DEBUGGING state for auto-restore after reconnect
          if (info.state === BotState.DEBUGGING) {
            this.wasDebugging.add(name);
          }
          // Detect void death: below Y=-64, or position unavailable but bot has recent deaths
          const recentDeaths = this.deathTimestamps.get(name) ?? [];
          const hasRecentDeaths = recentDeaths.length > 0;
          const isVoidDeath = lastY < -64 || (Number.isNaN(lastY) && hasRecentDeaths);

          if (isVoidDeath) {
            info.state = BotState.DEAD;
            info.deathCount += 1;
            this.onEvent(name, 'DIED', `${name} died (void, y=${Number.isNaN(lastY) ? 'unknown' : lastY.toFixed(1)})`);
            this.handleDeathRecovery(name, options);
            return;
          }

          // If bot has recent deaths and disconnects, use death recovery instead of blind reconnect
          if (hasRecentDeaths) {
            info.state = BotState.DEAD;
            info.deathCount += 1;
            this.onEvent(name, 'DIED', `${name} died (disconnect after recent deaths)`);
            this.handleDeathRecovery(name, options);
            return;
          }

          info.state = BotState.DISCONNECTED;
          info.lastDisconnectReason = reason ?? 'unknown';
          this.onEvent(name, 'DISCONNECTED', `${name} disconnected: ${reason}`);
          this.attemptReconnect(name, options);
        }
      }, 500);
    });

    bot.on('error', (err) => {
      const info = this.registry.get(name);
      if (info) {
        info.lastError = err.message;
        this.onEvent(name, 'ERROR', `${name} error on ${options.serverHost}:${options.serverPort}: ${err.message}`);
        // Handle connection-level errors like ECONNRESET by triggering reconnect
        // Skip if dead — death handler manages its own recovery
        if (info.state !== BotState.STOPPED && info.state !== BotState.DISCONNECTED && info.state !== BotState.DEAD) {
          if (info.state === BotState.DEBUGGING) {
            this.wasDebugging.add(name);
          }
          info.state = BotState.DISCONNECTED;
          this.attemptReconnect(name, options);
        }
      }
    });

    // Catch errors on underlying protocol client to prevent unhandled 'error' event crashes
    const client = (bot as any)._client;
    if (client) {
      client.on('error', (err: Error) => {
        const info = this.registry.get(name);
        if (info) {
          info.lastError = err.message;
          this.onEvent(name, 'ERROR', `${name} client error: ${err.message}`);
          // Also trigger reconnect from client-level errors (e.g. ECONNRESET)
          // Skip if dead — death handler manages its own recovery
          if (info.state !== BotState.STOPPED && info.state !== BotState.DISCONNECTED && info.state !== BotState.DEAD) {
            if (info.state === BotState.DEBUGGING) {
              this.wasDebugging.add(name);
            }
            info.state = BotState.DISCONNECTED;
            this.attemptReconnect(name, options);
          }
        }
      });
      // Socket may not exist immediately; attach error handler when socket connects
      const attachSocketHandler = () => {
        if (client.socket) {
          client.socket.on('error', (_err: Error) => {
            // Silently handled — client.on('error') / bot.on('error') will handle reconnect
          });
        }
      };
      if (client.socket) {
        attachSocketHandler();
      } else {
        client.once('connect', attachSocketHandler);
      }
    }

    bot.on('death', () => {
      const info = this.registry.get(name);
      // Only count death if not already detected via health=0
      const alreadyDead = info?.state === BotState.DEAD;
      if (info && !alreadyDead) {
        if (info.state === BotState.DEBUGGING) {
          this.wasDebugging.add(name);
        }
        info.state = BotState.DEAD;
        info.deathCount += 1;
        this.onEvent(name, 'DIED', `${name} died`);
        // health handler didn't fire — call recovery here
        this.handleDeathRecovery(name, options);
      }
      // If already DEAD, health handler already called handleDeathRecovery — skip
    });

    bot.on('respawn', () => {
      const info = this.registry.get(name);
      if (info && info.state === BotState.DEAD) {
        // If rapid-death detected, the server auto-respawned the bot but we want it DEAD.
        // Disconnect the bot to prevent further void-death cycles.
        if (this.autoRespawnSuspended.has(name)) {
          this.onEvent(name, 'RAPID_DEATH_DISCONNECT', `${name} server-respawned but rapid death detected — disconnecting`);
          try {
            bot.removeAllListeners();
            if ((bot as any)._client) (bot as any)._client.removeAllListeners();
            bot.quit();
          } catch { /* ignore */ }
          info.state = BotState.DEAD;
          return;
        }
        // Restore DEBUGGING state if bot was debugging before death
        if (this.wasDebugging.has(name)) {
          info.state = BotState.DEBUGGING;
          this.wasDebugging.delete(name);
          this.onEvent(name, 'DEBUG_RESTORED', `${name} respawned — debug mode restored`);
        } else {
          info.state = BotState.SPAWNED;
        }
      }
      this.onEvent(name, 'RESPAWNED', `${name} respawned`);
    });

    // Forward in-game chat messages to the server
    bot.on('messagestr', (message: string) => {
      if (message && this.onChatMessage) {
        this.onChatMessage(name, message);
      }
    });
  }

  /** Cooldown (ms) after reconnect retries exhausted before resetting and trying again */
  private static readonly RECONNECT_EXHAUSTION_RECOVERY_MS = 120_000;

  private attemptReconnect(name: string, options: ConnectOptions): void {
    const strategy = this.reconnectStrategies.get(name);
    if (!strategy) return;

    if (!strategy.shouldReconnect()) {
      // Retries exhausted — schedule a long-cooldown recovery instead of giving up
      this.clearReconnectTimer(name);
      this.onEvent(name, 'RECONNECT_EXHAUSTED', `${name} reconnect retries exhausted, will retry in ${BotConnector.RECONNECT_EXHAUSTION_RECOVERY_MS / 1000}s`);
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(name);
        strategy.reset();
        const info = this.registry.get(name);
        if (info && info.state !== BotState.STOPPED) {
          this.onEvent(name, 'RECONNECT_RECOVERY', `${name} attempting recovery reconnect after exhaustion cooldown`);
          this.connect(name, options);
        }
      }, BotConnector.RECONNECT_EXHAUSTION_RECOVERY_MS);
      this.reconnectTimers.set(name, timer);
      return;
    }

    strategy.recordFailure();
    const baseDelay = strategy.nextDelayMs();
    // Add random jitter (0-3s) to prevent thundering herd when many bots reconnect
    const jitter = Math.floor(Math.random() * 3000);
    const delay = baseDelay + jitter;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(name);
      this.connect(name, options);
    }, delay);
    this.reconnectTimers.set(name, timer);
  }

  private handleDeathRecovery(name: string, options: ConnectOptions): void {
    // Track death timestamps for rapid-death detection
    const now = Date.now();
    const timestamps = this.deathTimestamps.get(name) ?? [];
    timestamps.push(now);
    const cutoff = now - BotConnector.RAPID_DEATH_WINDOW_MS;
    const recent = timestamps.filter((t) => t > cutoff);
    this.deathTimestamps.set(name, recent);

    if (recent.length >= BotConnector.RAPID_DEATH_MAX) {
      this.autoRespawnSuspended.add(name);
      this.onEvent(
        name,
        'RAPID_DEATH',
        `${name} died ${recent.length} times in ${BotConnector.RAPID_DEATH_WINDOW_MS / 1000}s — auto-respawn suspended, will retry in ${BotConnector.RAPID_DEATH_RECOVERY_MS / 1000}s`,
      );
      // Schedule a recovery reconnect after a long cooldown instead of giving up forever
      this.clearReconnectTimer(name);
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(name);
        this.autoRespawnSuspended.delete(name);
        this.deathTimestamps.delete(name);
        const info = this.registry.get(name);
        if (info && info.state !== BotState.STOPPED) {
          this.onEvent(name, 'RAPID_DEATH_RECOVERY', `${name} attempting recovery reconnect after cooldown`);
          this.connect(name, options);
        }
      }, BotConnector.RAPID_DEATH_RECOVERY_MS);
      this.reconnectTimers.set(name, timer);
      return;
    }

    // Auto-respawn if configured and not suspended
    if (options.autoRespawn && !this.autoRespawnSuspended.has(name)) {
      setTimeout(() => {
        // Re-check suspension — it may have been set by a later death during this delay
        if (this.autoRespawnSuspended.has(name)) return;
        const current = this.registry.get(name);
        if (current?.state === BotState.DEAD) {
          // Check if bot connection is still alive for in-game respawn
          const botAlive = current.bot && (current.bot as any)._client?.socket?.writable;
          if (botAlive) {
            try {
              current.bot!.respawn();
              this.onEvent(name, 'AUTO_RESPAWN', `${name} auto-respawning in-game`);
              return;
            } catch { /* fall through to reconnect */ }
          }
          // Bot connection was lost after death — reconnect
          this.onEvent(name, 'AUTO_RESPAWN', `${name} reconnecting after death`);
          this.attemptReconnect(name, options);
        }
      }, 3000);
    }
  }

  private clearReconnectTimer(name: string): void {
    const timer = this.reconnectTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(name);
    }
  }
}

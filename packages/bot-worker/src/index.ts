import { BotRegistry } from './registry/bot-registry.js';
import { BotConnector } from './lifecycle/bot-connector.js';
import { BotHealthChecker } from './lifecycle/bot-health.js';
import { BehaviorEngine } from './behavior/behavior-engine.js';
import { BehaviorFactory } from './behavior/behavior-factory.js';
import { StateReporter } from './reporter/state-reporter.js';
import { EventReporter } from './reporter/event-reporter.js';
import { IpcHandler } from './ipc/ipc-handler.js';
import { createIpcSender } from './ipc/ipc-sender.js';
import { DebugSession } from './debug/debug-session.js';
import { ScriptExecutor } from './script/script-executor.js';
import { IpcEvent, type IpcMessage } from '@jian-agent/shared-protocol';
import { BotState } from '@jian-agent/shared-domain';
import { createNavigator } from './navigation/pathfinder.navigator.js';

// Prevent worker process crash from unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[BotWorker] Unhandled rejection:', err);
});

// Prevent worker crash from unhandled error events (e.g. ECONNRESET on underlying socket)
process.on('uncaughtException', (err) => {
  // Suppress known network errors that are already handled by bot-connector reconnect logic
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE' || code === 'ETIMEDOUT') {
    // Silently absorb — reconnect strategy handles recovery
    return;
  }
  console.error('[BotWorker] Uncaught exception:', err);
});

// Graceful shutdown on SIGTERM (sent by parent when force-killing workers)
process.on('SIGTERM', () => {
  process.exit(0);
});

const send = createIpcSender();
const registry = new BotRegistry();
const healthChecker = new BotHealthChecker(15_000);
const behaviorEngines = new Map<string, BehaviorEngine>();
const debugSessions = new Map<string, DebugSession>();
const scriptExecutors = new Map<string, ScriptExecutor>();

const eventReporter = new EventReporter((payload) => {
  send({ type: IpcEvent.EVENT_REPORT, payload });
});

function createBehaviorContext(
  botName: string,
  bot: any,
  params: Readonly<Record<string, unknown>>,
) {
  return {
    bot,
    params,
    navigator: createNavigator(params),
    reportEvent: (
      event: any,
      message?: string,
      metadata?: Readonly<Record<string, unknown>>,
    ) => {
      eventReporter.report(botName, event, message, metadata);
    },
  };
}

// Behavior tick loop — call tick() for all active behavior engines every 250ms
const BEHAVIOR_TICK_INTERVAL = 250;
setInterval(() => {
  for (const [name, engine] of behaviorEngines) {
    const info = registry.get(name);
    if (!info?.bot || !engine.current) continue;
    try {
      const result = engine.tick(
        createBehaviorContext(
          name,
          info.bot,
          info.currentBehavior ? (info as any)._behaviorParams ?? {} : {},
        ),
      );
      if (result && typeof (result as any).catch === 'function') {
        (result as Promise<void>).catch(() => { /* swallow tick errors */ });
      }
    } catch {
      // swallow tick errors
    }
  }
}, BEHAVIOR_TICK_INTERVAL);

const pendingBehaviors = new Map<string, string>();

const connector = new BotConnector(
  registry,
  healthChecker,
  (botName, event, message) => {
    eventReporter.report(botName, event as any, message);
    // Auto-apply behavior template when bot spawns
    if (event === 'SPAWNED') {
      const template = pendingBehaviors.get(botName);
      if (template && template !== 'idle') {
        // Delay behavior start to let world chunks load and prevent void falls
        setTimeout(() => {
          const info = registry.get(botName);
          const engine = behaviorEngines.get(botName);
          if (info?.bot && engine && info.state === BotState.SPAWNED) {
            try {
              const behavior = BehaviorFactory.create(template);
              engine.switchBehavior(
                behavior,
                createBehaviorContext(botName, info.bot, {}),
              ).catch(() => { /* swallow */ });
              info.currentBehavior = behavior;
              (info as any)._behaviorParams = {};
            } catch { /* unknown behavior template */ }
          }
        }, 5000);
      }
    }
  },
  // Chat message callback — forward to server via IPC
  (botName, message) => {
    send({
      type: IpcEvent.CHAT_MESSAGE,
      payload: { botName, message, timestamp: Date.now() },
    });
  },
);

const stateReporter = new StateReporter(
  registry,
  (payload) => send({ type: IpcEvent.STATE_REPORT, payload }),
  3_000,
);

const handler = new IpcHandler({
  onPing(payload) {
    send({
      type: IpcEvent.PONG,
      payload: {
        pid: process.pid ?? -1,
        timestamp: payload.timestamp,
        botCount: registry.size(),
      },
    });
  },
  onCreateBots(payload) {
    // Stagger connections to avoid MC server rate-limiting
    // Reduced from 4200ms to 500ms — Paper servers handle concurrent joins well
    const CONNECT_DELAY_MS = 500;
    payload.names.forEach((name, index) => {
      pendingBehaviors.set(name, payload.behaviorTemplate ?? 'idle');
      setTimeout(() => {
        const engine = new BehaviorEngine();
        behaviorEngines.set(name, engine);
        connector.connect(name, {
          serverHost: payload.serverHost,
          serverPort: payload.serverPort,
          serverVersion: payload.serverVersion,
          connectTimeoutMs: payload.connectTimeoutMs,
          reconnectEnabled: payload.reconnectEnabled,
          reconnectMaxRetries: payload.reconnectMaxRetries,
          autoRespawn: payload.autoRespawn ?? true,
        });
      }, index * CONNECT_DELAY_MS);
    });
  },
  onSetBehavior(payload) {
    const botName = payload.botName;
    if (!botName) return;
    const info = registry.get(botName);
    const engine = behaviorEngines.get(botName);
    if (!info || !engine || !info.bot) return;
    try {
      const behavior = BehaviorFactory.create(payload.behaviorName);
      const params = payload.params ?? {};
      engine.switchBehavior(
        behavior,
        createBehaviorContext(botName, info.bot, params),
      ).catch(() => { /* swallow async errors from behavior start/stop */ });
      info.currentBehavior = behavior;
      (info as any)._behaviorParams = params;
    } catch { /* unknown behavior name */ }
  },
  onStopBots(payload) {
    for (const name of payload.names) {
      connector.disconnect(name);
      behaviorEngines.delete(name);
      pendingBehaviors.delete(name);
    }
  },
  onShutdown() {
    stateReporter.stop();
    connector.disconnectAll();
    process.exit(0);
  },
  onDebugStart(payload) {
    const info = registry.get(payload.botName);
    const engine = behaviorEngines.get(payload.botName);
    if (!info || !engine) return;
    const session = new DebugSession(info, engine, (name, output) => {
      send({ type: IpcEvent.DEBUG_OUTPUT, payload: { botName: name, output } });
    });
    session.enter();
    debugSessions.set(payload.botName, session);
  },
  onDebugCommand(payload) {
    const session = debugSessions.get(payload.botName);
    if (session) session.executeCommand(payload.command);
  },
  onDebugStop(payload) {
    const session = debugSessions.get(payload.botName);
    if (session) {
      session.exit();
      debugSessions.delete(payload.botName);
    }
  },
  onExecuteScript(payload) {
    const info = registry.get(payload.botName);
    if (!info?.bot) return;
    // Stop any existing script for this bot
    const existing = scriptExecutors.get(payload.botName);
    if (existing) existing.stop();

    const executor = new ScriptExecutor(
      info.bot,
      (stepIndex, totalSteps, loopIteration, completed) => {
        send({
          type: IpcEvent.SCRIPT_PROGRESS,
          payload: {
            botName: payload.botName,
            stepIndex,
            totalSteps,
            loopIteration,
            completed,
          },
        });
        if (completed) scriptExecutors.delete(payload.botName);
      },
    );
    scriptExecutors.set(payload.botName, executor);
    executor.execute(payload.script).catch((err) => {
      console.error(`[Script] ${payload.botName} error:`, err);
      scriptExecutors.delete(payload.botName);
    });
  },
  onStopScript(payload) {
    const executor = scriptExecutors.get(payload.botName);
    if (executor) {
      executor.stop();
      scriptExecutors.delete(payload.botName);
    }
  },
  onGetBotDetail(payload) {
    const info = registry.get(payload.botName);
    const bot = info?.bot;
    if (!bot) {
      send({
        type: IpcEvent.BOT_DETAIL_RESPONSE,
        payload: { botName: payload.botName, requestId: payload.requestId, inventory: [], nearbyEntities: [], terrain: [] },
      });
      return;
    }

    const inventory = bot.inventory.slots
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => ({
        slot: item.slot,
        name: item.name,
        displayName: item.displayName ?? item.name,
        count: item.count,
        maxDurability: item.maxDurability ?? null,
        durabilityUsed: item.durabilityUsed ?? null,
      }));

    const botPos = bot.entity?.position;
    const nearbyEntities = Object.values(bot.entities)
      .filter((e) => e !== bot.entity && e.position && botPos)
      .map((e) => {
        const dist = botPos!.distanceTo(e.position);
        return {
          id: e.id,
          type: e.type ?? 'unknown',
          name: e.username ?? e.displayName ?? null,
          x: Math.round(e.position.x * 10) / 10,
          y: Math.round(e.position.y * 10) / 10,
          z: Math.round(e.position.z * 10) / 10,
          distance: Math.round(dist * 10) / 10,
          health: (e as any).health ?? null,
        };
      })
      .filter((e) => e.distance <= 48)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50);

    // Collect terrain: top-down view, 32x32 centered on bot
    const terrain: Array<{ x: number; z: number; y: number; name: string }> = [];
    if (botPos) {
      const cx = Math.floor(botPos.x);
      const cz = Math.floor(botPos.z);
      const RADIUS = 16;
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
          const bx = cx + dx;
          const bz = cz + dz;
          // Find the topmost non-air block at this xz
          let topY = Math.floor(botPos.y) + 4;
          let blockName = 'air';
          for (let by = topY; by >= Math.floor(botPos.y) - 10; by--) {
            try {
              const block = bot.blockAt({ x: bx, y: by, z: bz } as any);
              if (block && block.name !== 'air' && block.name !== 'void_air' && block.name !== 'cave_air') {
                blockName = block.name;
                topY = by;
                break;
              }
            } catch { break; }
          }
          if (blockName !== 'air') {
            terrain.push({ x: bx, z: bz, y: topY, name: blockName });
          }
        }
      }
    }

    send({
      type: IpcEvent.BOT_DETAIL_RESPONSE,
      payload: { botName: payload.botName, requestId: payload.requestId, inventory, nearbyEntities, terrain },
    });
  },
  onForceRespawn(payload) {
    connector.forceRespawn(payload.botName);
  },
});

process.on('message', (msg: unknown) => handler.handle(msg as IpcMessage<any>));
stateReporter.start();
send({ type: IpcEvent.WORKER_READY, payload: { pid: process.pid } });

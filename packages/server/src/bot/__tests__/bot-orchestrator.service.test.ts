import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotOrchestratorService } from '../bot-orchestrator.service';
import type { WorkerPoolService } from '../worker-pool.service';
import { IpcCommand, IpcEvent, type EventReportPayload, type BotScript } from '@jian-agent/shared-protocol';
import type { BotEventType } from '@jian-agent/shared-protocol';

describe('BotOrchestratorService', () => {
  let orchestrator: BotOrchestratorService;
  let pool: WorkerPoolService;
  let mockConfigService: any;
  let mockProcessManager: any;
  let mockBotState: any;
  let mockSavedBotConfig: any;
  let workerMessageHandler: ((pid: number, msg: any) => void) | undefined;
  let mockBotRealtime: any;

  beforeEach(() => {
    pool = {
      spawn: vi.fn((onMessage?: any, _onExit?: any) => {
        workerMessageHandler = onMessage;
        return { pid: 100 };
      }),
      sendTo: vi.fn(() => true),
      kill: vi.fn(),
      killAll: vi.fn(),
      broadcast: vi.fn(),
      size: vi.fn(() => 1),
      pids: vi.fn(() => [100]),
    } as unknown as WorkerPoolService;
    mockConfigService = {
      getById: vi.fn().mockResolvedValue({ id: 'srv-1', host: 'localhost', port: 25565 }),
    };
    mockProcessManager = {
      getState: vi.fn().mockReturnValue('RUNNING'),
    };
    mockBotState = {
      absorb: vi.fn(),
      removeWorker: vi.fn(),
      allBots: vi.fn().mockReturnValue([]),
    };
    mockSavedBotConfig = {
      list: vi.fn().mockResolvedValue([]),
    };
    const mockMultiServer = {
      getServer: vi.fn().mockResolvedValue(undefined),
    };
    mockBotRealtime = { pushDebugOutput: vi.fn(), pushBotEvent: vi.fn() };
    orchestrator = new BotOrchestratorService(
      pool,
      mockConfigService,
      mockProcessManager,
      mockMultiServer as any,
      mockBotState,
      mockBotRealtime as any,
      mockSavedBotConfig,
    );
  });

  it('should create bots by spawning worker and sending IPC', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    expect(pool.spawn).toHaveBeenCalledOnce();
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.CREATE_BOTS,
    }));
  });

  it('should truncate long bot name prefixes so every generated username stays within Minecraft limits', async () => {
    const result = await orchestrator.createBotBatch({
      serverId: 'srv-1',
      namePrefix: 'local-validation-run',
      count: 3,
      behavior: 'idle',
    });

    expect(result.createdNames).toHaveLength(3);
    expect(new Set(result.createdNames).size).toBe(3);
    expect(result.createdNames.every((name) => name.length <= 16)).toBe(true);
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.CREATE_BOTS,
      payload: expect.objectContaining({
        names: result.createdNames,
      }),
    }));
  });

  it('should set behavior for a bot', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    orchestrator.setBehavior('bot-1', 'idle', {});
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.SET_BEHAVIOR,
    }));
  });

  it('should stop specific bots', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    orchestrator.stopBots(['bot-1']);
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.STOP_BOTS,
    }));
  });

  it('should reconnect a specific bot', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    const result = orchestrator.reconnectBot('bot-1');
    expect(result).toBe(true);
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.RECONNECT_BOTS,
      payload: { names: ['bot-1'] },
    }));
  });

  it('should return false when reconnecting unknown bot', () => {
    const result = orchestrator.reconnectBot('unknown-bot');
    expect(result).toBe(false);
  });

  it('should execute script for a specific bot', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    const script: BotScript = {
      id: 'script-1',
      name: '简单脚本',
      loop: false,
      steps: [{ action: 'wait', params: { seconds: 1 } }],
    };

    const result = orchestrator.executeScript('bot-1', script);

    expect(result).toBe(true);
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({
      type: IpcCommand.EXECUTE_SCRIPT,
      payload: { botName: 'bot-1', script },
    }));
  });

  it('should ingest worker event reports with assignment context', async () => {
    await orchestrator.createBotBatch({
      serverId: 'srv-1',
      namePrefix: 'bot',
      count: 1,
      behavior: 'idle',
      validationRunId: 'run-1',
    });

    workerMessageHandler?.(100, {
      type: IpcEvent.EVENT_REPORT,
      payload: {
        events: [
          {
            botName: 'bot-1',
            groupId: 'default',
            event: 'SPAWNED' as BotEventType,
            message: 'bot-1 spawned',
            timestamp: 1_713_600_000_000,
          },
        ],
      } satisfies EventReportPayload,
    });

    expect(mockBotRealtime.pushBotEvent).toHaveBeenCalledWith(expect.objectContaining({
      botName: 'bot-1',
      groupId: 'default',
      event: 'SPAWNED',
      message: 'bot-1 spawned',
      timestamp: 1_713_600_000_000,
      serverId: 'srv-1',
      batchId: expect.any(String),
      validationRunId: 'run-1',
    }));
  });

  it('should preserve assignment context for late worker event reports after stop', async () => {
    await orchestrator.createBotBatch({
      serverId: 'srv-1',
      namePrefix: 'bot',
      count: 1,
      behavior: 'idle',
      validationRunId: 'run-1',
    });

    orchestrator.stopBots(['bot-1']);

    workerMessageHandler?.(100, {
      type: IpcEvent.EVENT_REPORT,
      payload: {
        events: [
          {
            botName: 'bot-1',
            groupId: 'default',
            event: 'DISCONNECTED' as BotEventType,
            message: 'late disconnect',
            timestamp: 1_713_600_010_000,
          },
        ],
      } satisfies EventReportPayload,
    });

    expect(mockBotRealtime.pushBotEvent).toHaveBeenCalledWith(expect.objectContaining({
      botName: 'bot-1',
      event: 'DISCONNECTED',
      message: 'late disconnect',
      serverId: 'srv-1',
      batchId: expect.any(String),
      validationRunId: 'run-1',
    }));
  });

  it('stopAll should broadcast SHUTDOWN and killAll', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    orchestrator.stopAll();
    expect(pool.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: IpcCommand.SHUTDOWN }),
    );
    expect(pool.killAll).toHaveBeenCalled();
  });

  it('stopBots should auto-kill worker with no remaining assignments', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    orchestrator.stopBots(['bot-1']);
    expect(pool.sendTo).toHaveBeenCalledWith(100, expect.objectContaining({ type: IpcCommand.STOP_BOTS }));
    expect(pool.kill).toHaveBeenCalledWith(100);
  });

  it('stopBots should NOT kill worker if other bots remain', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 2, behavior: 'idle' });
    orchestrator.stopBots(['bot-1']);
    expect(pool.kill).not.toHaveBeenCalled();
  });

  it('onModuleDestroy should call killAll', async () => {
    await orchestrator.createBotBatch({ serverId: 'srv-1', namePrefix: 'bot', count: 1, behavior: 'idle' });
    orchestrator.onModuleDestroy();
    expect(pool.killAll).toHaveBeenCalled();
  });
});

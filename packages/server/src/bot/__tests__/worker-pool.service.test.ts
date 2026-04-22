import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPoolService } from '../worker-pool.service';
import { IpcCommand, IpcEvent } from '@jian-agent/shared-protocol';

let nextPid = 12345;
const childHandlers = new Map<number, Map<string, Function>>();
vi.mock('child_process', () => ({
  fork: vi.fn(() => {
    const pid = nextPid++;
    const handlers = new Map<string, Function>();
    childHandlers.set(pid, handlers);
    return {
      pid,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, handler: Function) => {
        handlers.set(event, handler);
      }),
      send: vi.fn(),
      kill: vi.fn(),
      connected: true,
    };
  }),
}));

describe('WorkerPoolService', () => {
  let pool: WorkerPoolService;

  beforeEach(() => {
    nextPid = 12345;
    childHandlers.clear();
    pool = new WorkerPoolService();
  });

  afterEach(() => {
    pool.onModuleDestroy();
    vi.useRealTimers();
  });

  it('should spawn a new worker', () => {
    const worker = pool.spawn();
    expect(worker.pid).toBe(12345);
    expect(pool.size()).toBe(1);
  });

  it('should track spawned workers', () => {
    pool.spawn();
    pool.spawn();
    expect(pool.size()).toBe(2);
  });

  it('should kill a specific worker', () => {
    const worker = pool.spawn();
    pool.kill(worker.pid!);
    expect(pool.size()).toBe(0);
  });

  it('should kill all workers', () => {
    pool.spawn();
    pool.spawn();
    pool.killAll();
    expect(pool.size()).toBe(0);
  });

  it('should send IPC message to a worker', () => {
    const worker = pool.spawn();
    pool.sendTo(worker.pid!, { type: IpcCommand.PING, payload: { timestamp: 1 } });
    expect(worker.send).toHaveBeenCalledWith({ type: IpcCommand.PING, payload: { timestamp: 1 } });
  });

  it('should send SIGTERM when killing a worker', () => {
    const worker = pool.spawn();
    pool.kill(worker.pid!);
    expect(worker.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should schedule SIGKILL fallback after SIGTERM', () => {
    vi.useFakeTimers();
    const worker = pool.spawn();
    pool.kill(worker.pid!);
    expect(worker.kill).toHaveBeenCalledWith('SIGTERM');
    expect(worker.kill).not.toHaveBeenCalledWith('SIGKILL');

    vi.advanceTimersByTime(3000);
    expect(worker.kill).toHaveBeenCalledWith('SIGKILL');
    vi.useRealTimers();
  });

  it('should not throw when kill is called on already-dead worker', () => {
    const worker = pool.spawn();
    (worker.kill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Process already exited');
    });
    expect(() => pool.kill(worker.pid!)).not.toThrow();
  });

  it('should broadcast IPC message to all workers', () => {
    const w1 = pool.spawn();
    const w2 = pool.spawn();
    pool.broadcast({ type: IpcCommand.PING, payload: { timestamp: 1 } });
    expect(w1.send).toHaveBeenCalledWith({ type: IpcCommand.PING, payload: { timestamp: 1 } });
    expect(w2.send).toHaveBeenCalledWith({ type: IpcCommand.PING, payload: { timestamp: 1 } });
  });

  it('should return all pids', () => {
    pool.spawn();
    pool.spawn();
    const pids = pool.pids();
    expect(pids).toHaveLength(2);
    expect(pids).toEqual([12345, 12346]);
  });

  it('marks a worker ready when it emits WORKER_READY', () => {
    const worker = pool.spawn();
    const handler = childHandlers.get(worker.pid!)?.get('message');
    handler?.({ type: IpcEvent.WORKER_READY, payload: { pid: worker.pid } });

    expect(pool.getWorkerState(worker.pid!)?.ready).toBe(true);
    expect(pool.getWorkerState(worker.pid!)?.stale).toBe(false);
  });

  it('sends heartbeat pings and recycles stale workers', () => {
    vi.useFakeTimers();
    pool.onModuleDestroy();
    pool = new WorkerPoolService();
    const worker = pool.spawn();
    const handler = childHandlers.get(worker.pid!)?.get('message');
    handler?.({ type: IpcEvent.WORKER_READY, payload: { pid: worker.pid } });

    vi.advanceTimersByTime(10_000);
    expect(worker.send).toHaveBeenCalledWith({
      type: IpcCommand.PING,
      payload: { timestamp: expect.any(Number) },
    });

    vi.advanceTimersByTime(30_000);
    expect(worker.kill).toHaveBeenCalledWith('SIGTERM');
  });
});

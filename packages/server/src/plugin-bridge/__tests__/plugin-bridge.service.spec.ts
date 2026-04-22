import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginBridgeService } from '../plugin-bridge.service.js';

function createMockWs() {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as any;
}

describe('PluginBridgeService', () => {
  let service: PluginBridgeService;

  beforeEach(() => {
    service = new PluginBridgeService();
  });

  it('should add and retrieve connection', () => {
    const ws = createMockWs();
    const id = service.addConnection('srv-1', ws, 1, {
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'plugins'],
    });
    expect(id).toBeDefined();

    const conn = service.getConnection(id);
    expect(conn).toBeDefined();
    expect(conn!.serverId).toBe('srv-1');
    expect(conn!.runtimeKind).toBe('paper-1.21+');
    expect(conn!.capabilityMatrix).toContain('players');
  });

  it('should remove connection', () => {
    const ws = createMockWs();
    const id = service.addConnection('srv-1', ws, 1);
    service.removeConnection(id);
    expect(service.getConnection(id)).toBeUndefined();
  });

  it('should find connection by serverId', () => {
    const ws = createMockWs();
    service.addConnection('srv-42', ws, 1);
    const conn = service.getConnectionByServerId('srv-42');
    expect(conn).toBeDefined();
    expect(conn!.serverId).toBe('srv-42');
  });

  it('should send to plugin', () => {
    const ws = createMockWs();
    const id = service.addConnection('srv-1', ws, 1);
    const sent = service.sendToPlugin(id, 'server:command', { action: 'SNAPSHOT' });
    expect(sent).toBe(true);
    expect(ws.send).toHaveBeenCalledOnce();
  });

  it('should fail send to non-existent connection', () => {
    const sent = service.sendToPlugin('no-exist', 'ch', {});
    expect(sent).toBe(false);
  });

  it('should send command by serverId', () => {
    const ws = createMockWs();
    service.addConnection('srv-1', ws, 1);
    const sent = service.sendCommand('srv-1', 'SNAPSHOT', {}, 'r1');
    expect(sent).toBe(true);
    expect(ws.send).toHaveBeenCalledOnce();
  });

  it('should send console command', () => {
    const ws = createMockWs();
    service.addConnection('srv-1', ws, 1);
    const sent = service.sendConsoleCommand('srv-1', 'list', 'console-1');
    expect(sent).toBe(true);
    expect(ws.send).toHaveBeenCalledOnce();
    const parsed = JSON.parse(ws.send.mock.calls[0][0]);
    expect(parsed.channel).toBe('server:execute-console');
    expect(parsed.payload.command).toBe('list');
    expect(parsed.payload.requestId).toBe('console-1');
  });

  it('should fail console command to disconnected server', () => {
    const sent = service.sendConsoleCommand('no-exist', 'list', 'c1');
    expect(sent).toBe(false);
  });

  it('should send eval script', () => {
    const ws = createMockWs();
    service.addConnection('srv-1', ws, 1);
    const sent = service.sendEvalScript('srv-1', 'server.getOnlinePlayers().size()', 'eval-1');
    expect(sent).toBe(true);
    expect(ws.send).toHaveBeenCalledOnce();
    const parsed = JSON.parse(ws.send.mock.calls[0][0]);
    expect(parsed.channel).toBe('server:eval-script');
    expect(parsed.payload.script).toBe('server.getOnlinePlayers().size()');
    expect(parsed.payload.requestId).toBe('eval-1');
  });

  it('should fail eval script to disconnected server', () => {
    const sent = service.sendEvalScript('no-exist', 'x', 'e1');
    expect(sent).toBe(false);
  });
});

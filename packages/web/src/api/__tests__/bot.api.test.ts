import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCRIPT_PRESETS } from '@jian-agent/shared-protocol';

vi.mock('../client.js', () => ({ apiFetch: vi.fn() }));

import { botApi } from '../bot.api.js';
import { apiFetch } from '../client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('botApi', () => {
  describe('list', () => {
    it('calls /bots without params', async () => {
      mockedFetch.mockResolvedValue({ success: true, data: [], meta: {} });
      await botApi.list();
      expect(mockedFetch).toHaveBeenCalledWith('/bots');
    });

    it('builds query string from params', async () => {
      mockedFetch.mockResolvedValue({ success: true, data: [], meta: {} });
      await botApi.list({ serverId: 's1', status: 'online', search: 'bot', page: 2, limit: 20 });
      const url = mockedFetch.mock.calls[0]![0] as string;
      expect(url).toContain('serverId=s1');
      expect(url).toContain('status=online');
      expect(url).toContain('search=bot');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=20');
    });
  });

  it('stats calls /bots/stats', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: {} });
    await botApi.stats('serv1');
    expect(mockedFetch.mock.calls[0]![0]).toContain('/bots/stats?serverId=serv1');
  });

  it('createBatch sends POST /bots/create', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: {} });
    const dto = { serverId: 's', namePrefix: 'bot', count: 5 };
    await botApi.createBatch(dto);
    expect(mockedFetch).toHaveBeenCalledWith('/bots/create', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  });

  it('stop sends DELETE /bots/:name', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.stop('bot-1');
    expect(mockedFetch).toHaveBeenCalledWith('/bots/bot-1', { method: 'DELETE' });
  });

  it('stopAll sends POST /bots/stop-all', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.stopAll();
    expect(mockedFetch).toHaveBeenCalledWith('/bots/stop-all', { method: 'POST' });
  });

  it('debugStart sends POST /bots/:name/debug/start', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.debugStart('bot-1');
    expect(mockedFetch).toHaveBeenCalledWith('/bots/bot-1/debug/start', { method: 'POST' });
  });

  it('debugCommand sends POST with command body', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.debugCommand('bot-1', '/say hi');
    expect(mockedFetch).toHaveBeenCalledWith('/bots/bot-1/debug/command', {
      method: 'POST',
      body: JSON.stringify({ command: '/say hi' }),
    });
  });

  it('batchReconnect sends POST with botNames', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [] });
    await botApi.batchReconnect(['bot-1', 'bot-2']);
    expect(mockedFetch).toHaveBeenCalledWith('/bots/batch-reconnect', {
      method: 'POST',
      body: JSON.stringify({ botNames: ['bot-1', 'bot-2'] }),
    });
  });

  it('batchDelete sends POST with botNames', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.batchDelete(['bot-1', 'bot-2']);
    expect(mockedFetch).toHaveBeenCalledWith('/bots/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ botNames: ['bot-1', 'bot-2'] }),
    });
  });

  it('batchExecuteScript sends POST with botNames and script body', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [] });
    const script = SCRIPT_PRESETS[0]!;
    await botApi.batchExecuteScript(['bot-1'], script);
    expect(mockedFetch).toHaveBeenCalledWith('/bots/batch-script', {
      method: 'POST',
      body: JSON.stringify({ botNames: ['bot-1'], script }),
    });
  });

  it('listSavedConfigs adds serverId query', async () => {
    mockedFetch.mockResolvedValue({ success: true, data: [] });
    await botApi.listSavedConfigs('s1');
    expect(mockedFetch.mock.calls[0]![0]).toContain('/bots/saved-configs?serverId=s1');
  });

  it('deleteSavedConfig sends DELETE', async () => {
    mockedFetch.mockResolvedValue({ success: true });
    await botApi.deleteSavedConfig('cfg-1');
    expect(mockedFetch).toHaveBeenCalledWith('/bots/saved-configs/cfg-1', { method: 'DELETE' });
  });
});

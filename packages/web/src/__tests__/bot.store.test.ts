import { describe, it, expect, beforeEach } from 'vitest';
import { useBotStore } from '../stores/bot.store.js';

describe('useBotStore', () => {
  beforeEach(() => {
    useBotStore.setState({ bots: [], selectedBotName: null, loading: false, error: null, stats: null, meta: null, filter: { page: 1, limit: 50 } });
  });

  it('should select a bot', () => {
    useBotStore.getState().selectBot('bot_1');
    expect(useBotStore.getState().selectedBotName).toBe('bot_1');
  });

  it('should clear selection', () => {
    useBotStore.getState().selectBot('bot_1');
    useBotStore.getState().selectBot(null);
    expect(useBotStore.getState().selectedBotName).toBeNull();
  });

  it('should update filter', () => {
    useBotStore.getState().setFilter({ serverId: 'srv-1', search: 'test' });
    const f = useBotStore.getState().filter;
    expect(f.serverId).toBe('srv-1');
    expect(f.search).toBe('test');
  });
});

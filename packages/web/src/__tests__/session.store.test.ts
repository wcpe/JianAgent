import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../stores/session.store.js';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], selectedSessionId: null, loading: false });
  });

  it('should set sessions', () => {
    useSessionStore.getState().setSessions([{ id: 'sess_1', name: 'Test', state: 'CREATED' }]);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });

  it('should select a session', () => {
    useSessionStore.getState().selectSession('sess_1');
    expect(useSessionStore.getState().selectedSessionId).toBe('sess_1');
  });

  it('should update a single session state', () => {
    useSessionStore.getState().setSessions([
      { id: 'sess_1', name: 'T', state: 'CREATED' },
      { id: 'sess_2', name: 'T2', state: 'CREATED' },
    ]);
    useSessionStore.getState().updateSessionState('sess_1', 'RUNNING', 'ramp-up');
    const updated = useSessionStore.getState().sessions.find((s) => s.id === 'sess_1');
    expect(updated?.state).toBe('RUNNING');
  });
});

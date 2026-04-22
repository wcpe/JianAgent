import { describe, it, expect } from 'vitest';
import { PtySession } from '../pty-session.js';

describe('PtySession', () => {
  it('should store sessionId and have initial isAlive=false before start', () => {
    const session = new PtySession('sess-1');
    expect(session.sessionId).toBe('sess-1');
    expect(session.isAlive()).toBe(false);
  });

  it('should expose write() and resize() methods', () => {
    const session = new PtySession('sess-2');
    expect(typeof session.write).toBe('function');
    expect(typeof session.resize).toBe('function');
    expect(typeof session.kill).toBe('function');
  });
});

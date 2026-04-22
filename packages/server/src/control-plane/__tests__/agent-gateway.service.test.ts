import { describe, expect, it } from 'vitest';
import { AgentGatewayService } from '../agent/agent-gateway.service.js';

describe('AgentGatewayService', () => {
  it('stores heartbeat timestamp after register', () => {
    const eventBus = {
      emit: () => true,
    } as any;
    const service = new AgentGatewayService(eventBus);
    const state = service.register({
      id: 'agent-1',
      hostId: 'host-1',
      capabilities: ['jmx', 'jfr'],
    });

    expect(state.status).toBe('online');
    expect(state.lastHeartbeatAt).toBeGreaterThan(0);

    const hb = service.heartbeat('agent-1');
    expect(hb?.status).toBe('online');
    expect(service.list()).toHaveLength(1);
  });
});

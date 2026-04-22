import { Injectable } from '@nestjs/common';
import type { AgentStateDto } from '@jian-agent/shared-domain';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ControlPlaneAgentHeartbeatEvent,
  ControlPlaneAgentRegisteredEvent,
} from '../../event-bus/events.js';

@Injectable()
export class AgentGatewayService {
  private readonly agents = new Map<string, AgentStateDto>();

  constructor(private readonly eventBus: EventEmitter2) {}

  register(input: { id: string; hostId: string; capabilities: string[] }): AgentStateDto {
    const state: AgentStateDto = {
      id: input.id,
      hostId: input.hostId,
      status: 'online',
      capabilities: input.capabilities,
      lastHeartbeatAt: Date.now(),
    };
    this.agents.set(state.id, state);

    const event: ControlPlaneAgentRegisteredEvent = {
      agentId: state.id,
      hostId: state.hostId,
      capabilities: [...state.capabilities],
      timestamp: Date.now(),
    };
    this.eventBus.emit('control-plane.agent.registered', event);
    return state;
  }

  heartbeat(id: string): AgentStateDto | null {
    const state = this.agents.get(id);
    if (!state) return null;
    state.lastHeartbeatAt = Date.now();
    state.status = 'online';

    const event: ControlPlaneAgentHeartbeatEvent = {
      agentId: state.id,
      hostId: state.hostId,
      timestamp: Date.now(),
    };
    this.eventBus.emit('control-plane.agent.heartbeat', event);
    return state;
  }

  list(): AgentStateDto[] {
    return [...this.agents.values()];
  }
}

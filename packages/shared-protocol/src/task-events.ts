/**
 * Task events - bot events, session phases, worker events, control-plane events
 */

import type { PhaseRecord, ResourceRefDto, TaskStatusDto } from '@jian-agent/shared-domain';
import type { BotEventType } from './bot-events.js';

// Bot task events
export interface BotEventPayload {
  readonly resourceRef: ResourceRefDto;
  readonly botName: string;
  readonly groupId: string;
  readonly event: BotEventType;
  readonly message: string;
  readonly timestamp: number;
}

// Session task events
export interface SessionStatusPayload {
  readonly resourceRef: ResourceRefDto;
  readonly sessionId: string;
  readonly status: 'running' | 'paused' | 'stopped' | 'error';
  readonly timestamp: string;
  /** Unified task status for this session */
  readonly taskStatus?: TaskStatusDto;
}

export interface SessionPhasePayload {
  readonly resourceRef: ResourceRefDto;
  readonly sessionId: string;
  readonly phaseIndex: number;
  readonly phaseRecord: PhaseRecord;
}

export interface PhaseStatusPayload {
  readonly resourceRef: ResourceRefDto;
  readonly sessionId: string;
  readonly phaseIndex: number;
  readonly status: 'started' | 'completed' | 'failed';
  readonly timestamp: string;
  /** Unified task status for this phase */
  readonly taskStatus?: TaskStatusDto;
}

// Control-plane task events
export interface ControlPlaneAgentRegisteredPayload {
  readonly resourceRef: ResourceRefDto;
  readonly agentId: string;
  readonly timestamp: string;
}

export interface ControlPlaneAgentHeartbeatPayload {
  readonly resourceRef: ResourceRefDto;
  readonly agentId: string;
  readonly timestamp: string;
}

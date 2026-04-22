import type { ProbeRuntimeKind } from '@jian-agent/shared-domain';
import type { WebSocket } from 'ws';

export interface PluginConnection {
  readonly id: string;
  readonly serverId: string;
  readonly ws: WebSocket;
  readonly connectedAt: Date;
  readonly protocolVersion: number;
  readonly runtimeKind?: ProbeRuntimeKind;
  readonly capabilityMatrix?: readonly string[];
}

export interface PluginBridgeMessage<T = unknown> {
  readonly channel: string;
  readonly payload: T;
  readonly timestamp: string;
}

export interface HandshakeRequestPayload {
  readonly protocolVersion: number;
  readonly serverId: string;
  readonly pluginVersion: string;
  readonly serverVersion: string;
  readonly runtimeKind?: ProbeRuntimeKind;
  readonly capabilityMatrix?: readonly string[];
}

export interface HandshakeResponsePayload {
  readonly accepted: boolean;
  readonly protocolVersion: number;
  readonly reason?: string;
}

import { Module } from '@nestjs/common';
import { EventGateway } from './event.gateway.js';

/**
 * ServerEventModule – standalone module for WebSocket event streaming.
 *
 * Provides a unified event gateway that listens to internal event bus
 * events and broadcasts them to connected WebSocket clients.
 *
 * WebSocket endpoint: /ws/events
 *
 * Clients can subscribe to rooms:
 *   - server:<serverId>  – per-server events (output, state, crash, health)
 *   - servers:status     – all server status changes
 *   - control-plane:agents – agent registration/heartbeat
 *   - file-tasks         – file task state changes
 */
@Module({
  providers: [EventGateway],
  exports: [EventGateway],
})
export class ServerEventModule {}

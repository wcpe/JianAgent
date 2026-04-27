import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket, WebSocketServer as WsServer } from 'ws';
import { MonitoringService } from './monitoring.service.js';
import type { MonitoringSnapshotDto } from './dto/monitoring-snapshot.dto.js';
import type { Server as HttpServer } from 'http';
import { URL } from 'url';

interface SubscribeMonitoringMessage {
  pid: string;
  interval?: number;
}

interface UnsubscribeMonitoringMessage {
  pid: string;
}

/**
 * MonitoringGateway - WebSocket gateway for real-time JVM monitoring
 * 
 * Handles:
 *   - subscribe-monitoring: Start monitoring a JVM process
 *   - unsubscribe-monitoring: Stop monitoring a JVM process
 *   - monitoring-snapshot: (outbound) Real-time monitoring data
 * 
 * Connection rules:
 *   - Each PID can only have one active monitoring session
 *   - New connections replace old connections for the same PID
 *   - Monitoring automatically stops when client disconnects
 */
@WebSocketGateway({ path: '/ws/monitoring' })
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MonitoringGateway.name);

  @WebSocketServer()
  server!: Server;

  private wss: WsServer | null = null;

  /** Map of client -> Set of PIDs they're monitoring */
  private readonly clientSubscriptions = new Map<WebSocket, Set<string>>();

  /** Map of PID -> client currently monitoring it */
  private readonly pidToClient = new Map<string, WebSocket>();

  constructor(private readonly monitoringService: MonitoringService) {}

  attachToServer(httpServer: HttpServer): void {
    this.logger.log('Attaching MonitoringGateway to HTTP server...');
    
    this.wss = new WsServer({
      noServer: true,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.log('MonitoringGateway: WebSocket client connected');
      this.handleConnection(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.logger.debug(`MonitoringGateway received message: ${message.event}`);
          
          if (message.event === 'subscribe-monitoring') {
            this.handleSubscribe(message.data, ws);
          } else if (message.event === 'unsubscribe-monitoring') {
            this.handleUnsubscribe(message.data, ws);
          }
        } catch (err) {
          this.logger.error('Failed to parse WebSocket message', err);
        }
      });

      ws.on('close', () => {
        this.logger.log('MonitoringGateway: WebSocket client disconnected');
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        this.logger.error('MonitoringGateway WebSocket error', err);
      });
    });

    this.wss.on('error', (err) => {
      this.logger.error('MonitoringGateway WebSocketServer error', err);
    });

    this.logger.log('MonitoringGateway attached to HTTP server at /ws/monitoring');
  }

  handleUpgrade(request: any, socket: any, head: any): void {
    this.logger.log('MonitoringGateway: Handling WebSocket upgrade');
    this.wss!.handleUpgrade(request, socket, head, (ws) => {
      this.wss!.emit('connection', ws, request);
    });
  }

  handleConnection(client: WebSocket): void {
    this.logger.log('Monitoring WebSocket client connected');
    this.clientSubscriptions.set(client, new Set());
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('Monitoring WebSocket client disconnected');
    
    // Stop all monitoring sessions for this client
    const pids = this.clientSubscriptions.get(client);
    if (pids) {
      for (const pid of pids) {
        this.logger.log(`Auto-stopping monitoring for PID ${pid} due to client disconnect`);
        this.monitoringService.stopMonitoring(pid).catch((err) => {
          this.logger.error(`Failed to stop monitoring for PID ${pid}`, err);
        });
        this.pidToClient.delete(pid);
      }
      this.clientSubscriptions.delete(client);
    }
  }

  @SubscribeMessage('subscribe-monitoring')
  async handleSubscribe(
    @MessageBody() data: SubscribeMonitoringMessage,
    @ConnectedSocket() client: WebSocket,
  ): Promise<void> {
    const { pid, interval = 5 } = data;

    this.logger.log(`Client subscribing to monitoring for PID ${pid} with interval ${interval}s`);

    try {
      // Check if another client is already monitoring this PID
      const existingClient = this.pidToClient.get(pid);
      if (existingClient && existingClient !== client) {
        this.logger.log(`Replacing existing monitoring session for PID ${pid}`);
        
        // Remove from old client's subscriptions
        const oldClientPids = this.clientSubscriptions.get(existingClient);
        if (oldClientPids) {
          oldClientPids.delete(pid);
        }

        // Notify old client that their session was replaced
        if (existingClient.readyState === WebSocket.OPEN) {
          existingClient.send(JSON.stringify({
            type: 'monitoring-replaced',
            pid,
            message: 'Another client started monitoring this process',
          }));
        }
      }

      // Start monitoring with callback to send data to this client
      await this.monitoringService.startMonitoring(pid, interval, (snapshot) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(snapshot));
        }
      });

      // Track subscription
      const clientPids = this.clientSubscriptions.get(client);
      if (clientPids) {
        clientPids.add(pid);
      }
      this.pidToClient.set(pid, client);

      // Send success response
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'monitoring-started',
          pid,
          interval,
        }));
      }

      this.logger.log(`Monitoring started for PID ${pid}`);
    } catch (err) {
      this.logger.error(`Failed to start monitoring for PID ${pid}`, err);
      
      // Send error response
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'monitoring-error',
          pid,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    }
  }

  @SubscribeMessage('unsubscribe-monitoring')
  async handleUnsubscribe(
    @MessageBody() data: UnsubscribeMonitoringMessage,
    @ConnectedSocket() client: WebSocket,
  ): Promise<void> {
    const { pid } = data;

    this.logger.log(`Client unsubscribing from monitoring for PID ${pid}`);

    try {
      // Check if this client is actually monitoring this PID
      const currentClient = this.pidToClient.get(pid);
      if (currentClient !== client) {
        this.logger.warn(`Client tried to unsubscribe from PID ${pid} but is not the active monitor`);
        return;
      }

      // Stop monitoring
      await this.monitoringService.stopMonitoring(pid);

      // Remove from tracking
      const clientPids = this.clientSubscriptions.get(client);
      if (clientPids) {
        clientPids.delete(pid);
      }
      this.pidToClient.delete(pid);

      // Send success response
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'monitoring-stopped',
          pid,
        }));
      }

      this.logger.log(`Monitoring stopped for PID ${pid}`);
    } catch (err) {
      this.logger.error(`Failed to stop monitoring for PID ${pid}`, err);
      
      // Send error response
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'monitoring-error',
          pid,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    }
  }
}

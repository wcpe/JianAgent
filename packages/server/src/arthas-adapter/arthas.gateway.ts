import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { ArthasService } from './arthas.service.js';
import type { ExecuteCommandDto } from './dto/execute-command.dto.js';

interface ArthasCommandMessage {
  serverId: string;
  command: string;
  timeout?: number;
}

interface ArthasResultMessage {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

interface ArthasErrorMessage {
  error: string;
  timestamp: string;
}

@WebSocketGateway({ namespace: '/arthas' })
export class ArthasGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ArthasGateway.name);
  private readonly clientRooms = new Map<WebSocket, Set<string>>();

  constructor(private readonly arthasService: ArthasService) {}

  afterInit(server: Server): void {
    this.logger.log('Arthas WebSocket Gateway initialized');
  }

  handleConnection(client: WebSocket): void {
    this.logger.log('Client connected to Arthas gateway');
    this.clientRooms.set(client, new Set());
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('Client disconnected from Arthas gateway');
    this.clientRooms.delete(client);
  }

  /**
   * Handle command execution request
   * Client sends: { serverId: string, command: string, timeout?: number }
   */
  @SubscribeMessage('command')
  async handleCommand(
    @MessageBody() data: ArthasCommandMessage,
    @ConnectedSocket() client: WebSocket,
  ): Promise<void> {
    try {
      this.logger.debug(`Received command from client: ${data.command} for ${data.serverId}`);

      if (!data.serverId || !data.command) {
        this.sendError(client, 'serverId and command are required');
        return;
      }

      const dto: ExecuteCommandDto = {
        serverId: data.serverId,
        command: data.command,
        timeout: data.timeout,
      };

      const result = await this.arthasService.executeCommand(dto);

      this.sendResult(client, result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling command: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      this.sendError(client, errorMessage);
    }
  }

  /**
   * Subscribe to a server's Arthas output
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { serverId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    if (!data.serverId) {
      this.sendError(client, 'serverId is required');
      return;
    }

    const rooms = this.clientRooms.get(client);
    if (rooms) {
      rooms.add(data.serverId);
      this.logger.debug(`Client subscribed to server ${data.serverId}`);
      
      // Send acknowledgment
      this.sendToClient(client, 'subscribed', { serverId: data.serverId });
    }
  }

  /**
   * Unsubscribe from a server's Arthas output
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { serverId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    if (!data.serverId) {
      this.sendError(client, 'serverId is required');
      return;
    }

    const rooms = this.clientRooms.get(client);
    if (rooms) {
      rooms.delete(data.serverId);
      this.logger.debug(`Client unsubscribed from server ${data.serverId}`);
      
      // Send acknowledgment
      this.sendToClient(client, 'unsubscribed', { serverId: data.serverId });
    }
  }

  /**
   * Send command result to client
   */
  private sendResult(client: WebSocket, result: ArthasResultMessage): void {
    this.sendToClient(client, 'result', result);
  }

  /**
   * Send error to client
   */
  private sendError(client: WebSocket, error: string): void {
    const errorMessage: ArthasErrorMessage = {
      error,
      timestamp: new Date().toISOString(),
    };
    this.sendToClient(client, 'error', errorMessage);
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: WebSocket, event: string, data: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ event, data }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send message to client: ${errorMessage}`);
      }
    }
  }

  /**
   * Broadcast message to all clients subscribed to a server
   */
  broadcastToServer(serverId: string, event: string, data: any): void {
    let sentCount = 0;
    
    for (const [client, rooms] of this.clientRooms.entries()) {
      if (rooms.has(serverId)) {
        this.sendToClient(client, event, data);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      this.logger.debug(`Broadcasted ${event} to ${sentCount} clients for server ${serverId}`);
    }
  }
}

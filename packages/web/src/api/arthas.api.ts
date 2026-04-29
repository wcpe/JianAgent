import { apiFetch } from './client.js';

export interface ArthasServer {
  readonly serverId: string;
  readonly pid: number;
  readonly httpPort: number;
  readonly telnetPort: number;
  readonly attached: boolean;
  readonly uptime?: number;
  readonly version?: string;
}

export interface AttachRequest {
  readonly pid: number;
  readonly httpPort?: number;
  readonly telnetPort?: number;
  readonly tunnelServer?: string;
}

export interface AttachResult {
  readonly success: boolean;
  readonly serverId: string;
  readonly httpPort: number;
  readonly telnetPort: number;
  readonly error?: string;
}

export interface CommandResult {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly executionTime: number;
}

export interface ArthasStatus {
  readonly attached: boolean;
  readonly serverId: string;
  readonly pid?: number;
  readonly httpPort?: number;
  readonly telnetPort?: number;
  readonly uptime?: number;
  readonly version?: string;
}

export const arthasApi = {
  /**
   * Attach Arthas to a Java process
   */
  async attach(request: AttachRequest, serverId = '1'): Promise<AttachResult> {
    return apiFetch<AttachResult>(`/arthas/attach/${serverId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Detach Arthas from current process
   */
  async detach(serverId: string): Promise<void> {
    await apiFetch(`/arthas/detach/${serverId}`, {
      method: 'POST',
    });
  },

  /**
   * Get Arthas status
   */
  async getStatus(serverId: string): Promise<ArthasStatus> {
    return apiFetch<ArthasStatus>(`/arthas/status/${serverId}`);
  },

  /**
   * Execute Arthas command (HTTP API)
   */
  async executeCommand(serverId: string, command: string, timeout?: number): Promise<CommandResult> {
    return apiFetch<CommandResult>('/arthas/execute', {
      method: 'POST',
      body: JSON.stringify({ serverId, command, timeout }),
    });
  },

  /**
   * List all active Arthas servers
   */
  async listServers(): Promise<ArthasServer[]> {
    return apiFetch<ArthasServer[]>('/arthas/servers');
  },
};

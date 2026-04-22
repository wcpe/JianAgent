import type { ResourceSummaryDto } from './resource-summary.dto.js';
import { ResourceKind } from '../enums/resource-kind.js';
export type ServerType = 'managed' | 'external';
export type SshAuthType = 'password' | 'key';

export interface ServerConfig {
  readonly id: string;
  readonly name: string;
  readonly serverType: ServerType;
  readonly javaPath: string;
  readonly jarPath: string;
  readonly workDir: string;
  readonly jvmArgs: readonly string[];
  readonly serverArgs: readonly string[];
  readonly envVars: Readonly<Record<string, string>>;
  readonly encoding: string;
  readonly autoRestart: boolean;
  readonly maxRestarts: number;
  readonly host: string;
  readonly port: number;
  readonly sshHost: string;
  readonly sshPort: number;
  readonly sshUsername: string;
  readonly sshAuthType: SshAuthType;
  readonly sshPassword: string;
  readonly sshKeyPath: string;
  readonly sshPassphrase: string;
  readonly serverDir: string;
  readonly logsPath: string;
  readonly runtimeId: string;
  readonly probeVersion: string;
  readonly preStartCommand: string;
  readonly postStartCommand: string;
  readonly preStopCommand: string;
  readonly postStopCommand: string;
  readonly scriptTimeoutMs: number;
  readonly readyPattern: string;
  readonly readyTimeoutMs: number;
  readonly serverGroup: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateServerConfigRequest {
  readonly name: string;
  readonly serverType?: ServerType;
  readonly javaPath?: string;
  readonly jarPath?: string;
  readonly workDir?: string;
  readonly jvmArgs?: readonly string[];
  readonly serverArgs?: readonly string[];
  readonly envVars?: Readonly<Record<string, string>>;
  readonly encoding?: string;
  readonly autoRestart?: boolean;
  readonly maxRestarts?: number;
  readonly host?: string;
  readonly port?: number;
  readonly sshHost?: string;
  readonly sshPort?: number;
  readonly sshUsername?: string;
  readonly sshAuthType?: SshAuthType;
  readonly sshPassword?: string;
  readonly sshKeyPath?: string;
  readonly sshPassphrase?: string;
  readonly serverDir?: string;
  readonly logsPath?: string;
  readonly runtimeId?: string;
  readonly preStartCommand?: string;
  readonly postStartCommand?: string;
  readonly preStopCommand?: string;
  readonly postStopCommand?: string;
  readonly scriptTimeoutMs?: number;
  readonly readyPattern?: string;
  readonly readyTimeoutMs?: number;
  readonly serverGroup?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
}

export interface UpdateServerConfigRequest {
  readonly name?: string;
  readonly serverType?: ServerType;
  readonly javaPath?: string;
  readonly jarPath?: string;
  readonly workDir?: string;
  readonly jvmArgs?: readonly string[];
  readonly serverArgs?: readonly string[];
  readonly envVars?: Readonly<Record<string, string>>;
  readonly encoding?: string;
  readonly autoRestart?: boolean;
  readonly maxRestarts?: number;
  readonly host?: string;
  readonly port?: number;
  readonly sshHost?: string;
  readonly sshPort?: number;
  readonly sshUsername?: string;
  readonly sshAuthType?: SshAuthType;
  readonly sshPassword?: string;
  readonly sshKeyPath?: string;
  readonly sshPassphrase?: string;
  readonly serverDir?: string;
  readonly logsPath?: string;
  readonly runtimeId?: string;
  readonly preStartCommand?: string;
  readonly postStartCommand?: string;
  readonly preStopCommand?: string;
  readonly postStopCommand?: string;
  readonly scriptTimeoutMs?: number;
  readonly readyPattern?: string;
  readonly readyTimeoutMs?: number;
  readonly serverGroup?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
}

export interface ServerWithStatusDto {
  readonly id: string;
  readonly name: string;
  readonly serverType: ServerType;
  readonly host: string;
  readonly port: number;
  readonly jarPath: string;
  readonly workDir: string;
  readonly runtimeStatus: 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'unknown';
  readonly pid?: number;
  readonly uptime?: number;
  readonly restartCount: number;
  readonly motd?: string;
  readonly motdRaw?: string;
  readonly onlinePlayers?: number;
  readonly maxPlayers?: number;
  readonly version?: string;
  readonly favicon?: string;
  readonly latencyMs?: number;
  readonly serverGroup?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export function serverToResourceSummary(server: ServerWithStatusDto): ResourceSummaryDto {
  return {
    id: server.id,
    kind: ResourceKind.SERVER,
    name: server.name,
    status: server.runtimeStatus,
    statusDetail: null,
    hostType: 'local',
    host: server.host,
    port: server.port,
    tags: server.tags ?? [],
    createdAt: server.createdAt ?? '',
    updatedAt: server.updatedAt ?? '',
  };
}

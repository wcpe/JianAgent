import type { ResourceSummaryDto } from './resource-summary.dto.js';
import { ResourceKind } from '../enums/resource-kind.js';
export interface RemoteHostDto {
  readonly id: string;
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly authType: 'password' | 'key';
  readonly tags: readonly string[];
  readonly description: string;
  readonly status: string;
  readonly lastConnectedAt: string | null;
  readonly hasPassword?: boolean;
  readonly hasPassphrase?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateRemoteHostRequest {
  readonly name: string;
  readonly host: string;
  readonly port?: number;
  readonly username: string;
  readonly authType: 'password' | 'key';
  readonly password?: string;
  readonly keyPath?: string;
  readonly passphrase?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
}

export interface UpdateRemoteHostRequest {
  readonly name?: string;
  readonly host?: string;
  readonly port?: number;
  readonly username?: string;
  readonly authType?: 'password' | 'key';
  readonly password?: string;
  readonly keyPath?: string;
  readonly passphrase?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
}

export interface SshConnectConfig {
  readonly id: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly authType: 'password' | 'key';
  readonly passwordEncrypted: string;
  readonly keyPath: string;
  readonly passphraseEncrypted: string;
  readonly serverDir?: string;
}

export function remoteHostToResourceSummary(host: RemoteHostDto): ResourceSummaryDto {
  return {
    id: host.id,
    kind: ResourceKind.REMOTE_HOST,
    name: host.name,
    status: host.status,
    statusDetail: null,
    hostType: 'remote',
    host: host.host,
    port: host.port,
    tags: host.tags,
    createdAt: host.createdAt,
    updatedAt: host.updatedAt,
  };
}

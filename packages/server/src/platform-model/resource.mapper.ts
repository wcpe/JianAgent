import { Injectable } from '@nestjs/common';
import {
  ResourceKind,
  serverToResourceSummary,
  remoteHostToResourceSummary,
} from '@jian-agent/shared-domain';
import type {
  ResourceSummaryDto,
  ServerWithStatusDto,
  RemoteHostDto,
  HostType,
} from '@jian-agent/shared-domain';

/** External JVM application from the control-plane. */
export interface ExternalJvmSource {
  readonly id: string;
  readonly name: string;
  readonly runtimeType: string;
  readonly status?: string;
  readonly host?: string | null;
  readonly port?: number | null;
}

/** Generic resource source for ad-hoc mapping. */
export interface GenericResourceSource {
  readonly id: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly status: string;
  readonly statusDetail?: string | null;
  readonly hostType?: HostType;
  readonly host?: string | null;
  readonly port?: number | null;
  readonly tags?: readonly string[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

@Injectable()
export class ResourceMapper {
  /** Map a managed server to a unified resource summary. */
  fromServer(server: ServerWithStatusDto): ResourceSummaryDto {
    return serverToResourceSummary(server);
  }

  /** Map a remote host to a unified resource summary. */
  fromRemoteHost(host: RemoteHostDto): ResourceSummaryDto {
    return remoteHostToResourceSummary(host);
  }

  /** Map an external JVM application to a unified resource summary. */
  fromExternalJvm(app: ExternalJvmSource): ResourceSummaryDto {
    return {
      id: app.id,
      kind: ResourceKind.RUNTIME,
      name: app.name,
      status: app.status ?? 'unknown',
      statusDetail: `runtime=${app.runtimeType}`,
      hostType: 'remote',
      host: app.host ?? null,
      port: app.port ?? null,
      tags: [],
      createdAt: '',
      updatedAt: '',
    };
  }

  /** Map any conforming source to a unified resource summary. */
  fromGeneric(source: GenericResourceSource): ResourceSummaryDto {
    return {
      id: source.id,
      kind: source.kind,
      name: source.name,
      status: source.status,
      statusDetail: source.statusDetail ?? null,
      hostType: source.hostType ?? 'local',
      host: source.host ?? null,
      port: source.port ?? null,
      tags: source.tags ?? [],
      createdAt: source.createdAt ?? '',
      updatedAt: source.updatedAt ?? '',
    };
  }
}

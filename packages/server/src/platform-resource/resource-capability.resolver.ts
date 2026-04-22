import { Injectable, Logger } from '@nestjs/common';
import { ResourceKind } from '@jian-agent/shared-domain';
import type {
  ResourceCapabilityDto,
  ServerWithStatusDto,
  RemoteHostDto,
} from '@jian-agent/shared-domain';

/**
 * Resolves the available capability set for a given resource.
 *
 * Capabilities are determined by resource kind, runtime state, and
 * optional references to attached subsystems (Java helper, probe, etc.).
 */
@Injectable()
export class ResourceCapabilityResolver {
  private readonly logger = new Logger(ResourceCapabilityResolver.name);

  /** Resolve capabilities for a managed or external Minecraft server. */
  resolveForServer(
    server: ServerWithStatusDto,
    opts?: {
      helperAttached?: boolean;
      jfrSupported?: boolean;
      probeActive?: boolean;
      jmxEnabled?: boolean;
      pluginCount?: number;
      logCollectionCount?: number;
      alertRuleCount?: number;
    },
  ): ResourceCapabilityDto {
    const isRunning = server.runtimeStatus === 'running';
    const isManaged = server.serverType === 'managed';

    return {
      terminal: {
        enabled: isManaged,
        maxSessions: isManaged ? 3 : null,
      },
      files: {
        enabled: isManaged,
        rootPath: isManaged ? server.workDir : null,
      },
      plugins: {
        enabled: isManaged,
        pluginCount: opts?.pluginCount ?? 0,
      },
      logs: {
        enabled: true,
        collectionCount: opts?.logCollectionCount ?? 0,
      },
      audit: {
        enabled: true,
      },
      jvm: {
        enabled: isManaged,
        helperAttached: opts?.helperAttached ?? false,
        jfrSupported: opts?.jfrSupported ?? false,
      },
      monitoring: {
        enabled: isManaged,
        probeActive: opts?.probeActive ?? false,
        jmxEnabled: opts?.jmxEnabled ?? false,
        alertRuleCount: opts?.alertRuleCount ?? 0,
      },
      validation: {
        enabled: true,
      },
      minecraft: {
        enabled: isManaged,
        isMinecraft: true,
        serverVersion: server.version ?? null,
        probeConnected: opts?.probeActive ?? false,
      },
    };
  }

  /** Resolve capabilities for a remote SSH host. */
  resolveForRemoteHost(host: RemoteHostDto): ResourceCapabilityDto {
    const isOnline = host.status === 'online';

    return {
      terminal: {
        enabled: isOnline,
        maxSessions: 1,
      },
      files: {
        enabled: false,
        rootPath: null,
      },
      plugins: {
        enabled: false,
        pluginCount: 0,
      },
      logs: {
        enabled: false,
        collectionCount: 0,
      },
      audit: {
        enabled: false,
      },
      jvm: {
        enabled: false,
        helperAttached: false,
        jfrSupported: false,
      },
      monitoring: {
        enabled: isOnline,
        probeActive: false,
        jmxEnabled: false,
        alertRuleCount: 0,
      },
      validation: {
        enabled: false,
      },
      minecraft: {
        enabled: false,
        isMinecraft: false,
        serverVersion: null,
        probeConnected: false,
      },
    };
  }

  /** Resolve capabilities for any supported resource kind. */
  resolve(
    kind: string,
    server?: ServerWithStatusDto,
    remoteHost?: RemoteHostDto,
    serverOpts?: Parameters<this['resolveForServer']>[1],
  ): ResourceCapabilityDto {
    switch (kind) {
      case ResourceKind.SERVER:
        if (!server) {
          this.logger.warn(
            `Cannot resolve SERVER capabilities without server data`,
          );
          return this.disabledCapabilities();
        }
        return this.resolveForServer(server, serverOpts);
      case ResourceKind.REMOTE_HOST:
        if (!remoteHost) {
          this.logger.warn(
            `Cannot resolve REMOTE_HOST capabilities without host data`,
          );
          return this.disabledCapabilities();
        }
        return this.resolveForRemoteHost(remoteHost);
      default:
        this.logger.warn(
          `Unknown resource kind "${kind}", returning disabled capabilities`,
        );
        return this.disabledCapabilities();
    }
  }

  private disabledCapabilities(): ResourceCapabilityDto {
    return {
      terminal: { enabled: false, maxSessions: null },
      files: { enabled: false, rootPath: null },
      plugins: { enabled: false, pluginCount: 0 },
      logs: { enabled: false, collectionCount: 0 },
      audit: { enabled: false },
      jvm: { enabled: false, helperAttached: false, jfrSupported: false },
      monitoring: {
        enabled: false,
        probeActive: false,
        jmxEnabled: false,
        alertRuleCount: 0,
      },
      validation: { enabled: false },
      minecraft: {
        enabled: false,
        isMinecraft: false,
        serverVersion: null,
        probeConnected: false,
      },
    };
  }
}

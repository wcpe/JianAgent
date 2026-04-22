import { Injectable, Logger } from '@nestjs/common';
import {
  PluginInstallState,
  PluginRuntimeState,
} from '@jian-agent/shared-domain';
import type { PluginMetadataDto } from '@jian-agent/shared-domain';
import type { DiskPluginEntry } from './scanners/plugin-scanner.interface.js';
import { SnapshotService } from '../plugin-bridge/snapshot.service.js';
import {
  PluginConfigDiscoveryService,
  type PluginConfigDiscovery,
  VersionReplacementRisk,
} from './plugin-config-discovery.service.js';

/**
 * Runtime state derived from the latest probe snapshot for a single plugin.
 */
interface RuntimePluginInfo {
  readonly enabled: boolean;
  readonly version: string;
  readonly authors: readonly string[];
}

/** Empty config discovery fallback when plugin has no config directory. */
const EMPTY_DISCOVERY: PluginConfigDiscovery = {
  configDir: '',
  configDirExists: false,
  mainConfigFile: null,
  configFiles: [],
  hasConfigOverride: false,
  versionReplacementRisk: VersionReplacementRisk.NONE,
};

/**
 * Resolves the final plugin metadata by merging disk scan results with
 * runtime probe data from SnapshotService and config discovery.
 */
@Injectable()
export class PluginStateResolver {
  private readonly logger = new Logger(PluginStateResolver.name);

  constructor(
    private readonly snapshotService: SnapshotService,
    private readonly configDiscovery: PluginConfigDiscoveryService,
  ) {}

  /**
   * Merge disk entries with runtime snapshot into final PluginMetadataDto list.
   * Also performs config discovery for each plugin.
   */
  async resolve(
    serverId: string,
    diskEntries: readonly DiskPluginEntry[],
  ): Promise<readonly PluginMetadataDto[]> {
    const runtimeMap = this.getRuntimeMap(serverId);

    // Batch discover configs for all disk plugins.
    const pluginKeys = diskEntries.map((e) => e.key);
    const configMap = await this.configDiscovery.discoverBatch(
      serverId,
      pluginKeys,
    );

    const result: PluginMetadataDto[] = [];

    for (const entry of diskEntries) {
      const runtime = runtimeMap.get(entry.key);
      const descriptor = entry.descriptor;
      const config = configMap.get(entry.key) ?? EMPTY_DISCOVERY;

      const runtimeState = this.deriveRuntimeState(entry, runtime);
      const installState = entry.installState;

      // Add version replacement risk warnings to the general warnings.
      const baseWarnings = this.collectWarnings(entry, runtime);
      const riskWarnings = this.mergeRiskWarnings(baseWarnings, config);

      result.push({
        name: descriptor?.name ?? entry.key,
        version: runtime?.version ?? descriptor?.version ?? '',
        authors: descriptor?.authors ?? runtime?.authors ?? [],
        dependencies: descriptor?.depend ?? [],
        mainClass: descriptor?.main ?? '',
        filename: entry.filename,
        configDir: `${entry.key}/`,
        installState,
        runtimeState,
        requiresRestart: this.needsRestart(installState, runtimeState),
        riskWarnings,
        configFiles: config.configFiles,
        mainConfigFile: config.mainConfigFile,
        hasConfigOverride: config.hasConfigOverride,
        versionReplacementRisk: config.versionReplacementRisk,
      });
    }

    // Also include runtime-only plugins (loaded but JAR missing on disk)
    for (const [key, runtime] of runtimeMap) {
      if (result.some((p) => p.name.toLowerCase() === key)) continue;

      result.push({
        name: key,
        version: runtime.version,
        authors: runtime.authors,
        dependencies: [],
        mainClass: '',
        filename: '',
        configDir: `${key}/`,
        installState: PluginInstallState.CORRUPTED,
        runtimeState: PluginRuntimeState.RUNNING,
        requiresRestart: false,
        riskWarnings: ['Plugin is running but JAR file not found on disk'],
        configFiles: [],
        mainConfigFile: null,
        hasConfigOverride: false,
        versionReplacementRisk: VersionReplacementRisk.NONE,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build a lowercase-name → runtime-info map from the latest snapshot. */
  private getRuntimeMap(
    serverId: string,
  ): Map<string, RuntimePluginInfo> {
    const map = new Map<string, RuntimePluginInfo>();
    const stored = this.snapshotService.getLatest(serverId);
    if (!stored?.snapshot.plugins) return map;

    for (const p of stored.snapshot.plugins) {
      if (!p.name) continue;
      map.set(p.name.toLowerCase(), {
        enabled: p.enabled ?? true,
        version: p.version ?? '',
        authors: p.authors ?? [],
      });
    }
    return map;
  }

  private deriveRuntimeState(
    entry: DiskPluginEntry,
    runtime: RuntimePluginInfo | undefined,
  ): PluginRuntimeState {
    // Plugin disabled on disk → definitely not running
    if (entry.disabledOnDisk) {
      return PluginRuntimeState.STOPPED;
    }

    // If we have runtime data and the probe says it's enabled, it's running
    if (runtime && runtime.enabled) {
      return PluginRuntimeState.RUNNING;
    }

    // If we have runtime data but it says disabled
    if (runtime && !runtime.enabled) {
      return PluginRuntimeState.STOPPED;
    }

    // No runtime data — server may be offline or plugin not yet loaded
    if (entry.descriptor === null) {
      // Can't even read plugin.yml — likely corrupted
      return PluginRuntimeState.LOAD_ERROR;
    }

    // JAR exists on disk, plugin.yml readable, but no runtime probe data
    // → server may be offline, treat as STOPPED
    return PluginRuntimeState.STOPPED;
  }

  private needsRestart(
    installState: PluginInstallState,
    runtimeState: PluginRuntimeState,
  ): boolean {
    // Disabled on disk but runtime thinks it's running → needs restart to unload
    if (
      installState === PluginInstallState.DISABLED &&
      runtimeState === PluginRuntimeState.RUNNING
    ) {
      return true;
    }
    // Installed on disk but runtime thinks stopped → needs restart to load
    if (
      installState === PluginInstallState.INSTALLED &&
      runtimeState === PluginRuntimeState.STOPPED
    ) {
      return true;
    }
    return false;
  }

  private collectWarnings(
    entry: DiskPluginEntry,
    runtime: RuntimePluginInfo | undefined,
  ): readonly string[] {
    const warnings: string[] = [];

    if (entry.descriptor === null && !entry.disabledOnDisk) {
      warnings.push('Unable to read plugin.yml — JAR may be corrupted');
    }

    if (runtime && entry.installState === PluginInstallState.DISABLED) {
      warnings.push('Plugin is disabled on disk but still running — restart required');
    }

    if (
      !runtime &&
      entry.installState === PluginInstallState.INSTALLED &&
      entry.descriptor !== null
    ) {
      warnings.push('Plugin is installed but not detected in server runtime');
    }

    return warnings;
  }

  /**
   * Merge base risk warnings with config-driven version replacement warnings.
   */
  private mergeRiskWarnings(
    baseWarnings: readonly string[],
    config: PluginConfigDiscovery,
  ): readonly string[] {
    const warnings = [...baseWarnings];

    if (config.versionReplacementRisk === VersionReplacementRisk.HIGH) {
      warnings.push(
        'High risk: plugin has multiple config overrides — version replacement may cause incompatibility',
      );
    } else if (config.versionReplacementRisk === VersionReplacementRisk.MEDIUM) {
      warnings.push(
        'Medium risk: plugin has custom config overrides — verify compatibility before replacing',
      );
    }

    return warnings;
  }
}

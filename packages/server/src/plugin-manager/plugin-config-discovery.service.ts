import { Injectable, Logger } from '@nestjs/common';
import { FileManagerService } from '../file-manager/file-manager.service.js';
import type { FileEntry } from '../ssh/sftp-file.service.js';

/** Resolved config entry for a single plugin config file. */
export interface PluginConfigEntry {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: string;
}

/** Result of config discovery for a single plugin. */
export interface PluginConfigDiscovery {
  readonly configDir: string;
  readonly configDirExists: boolean;
  readonly mainConfigFile: PluginConfigEntry | null;
  readonly configFiles: readonly PluginConfigEntry[];
  readonly hasConfigOverride: boolean;
  readonly versionReplacementRisk: VersionReplacementRisk;
}

/** Severity levels for version replacement risk. */
export const VersionReplacementRisk = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type VersionReplacementRisk =
  (typeof VersionReplacementRisk)[keyof typeof VersionReplacementRisk];

const PLUGINS_DIR = 'plugins';

// Well-known config file names that plugins typically use as their main config.
const MAIN_CONFIG_CANDIDATES = [
  'config.yml',
  'config.yaml',
  'config.json',
  'config.toml',
  'config.properties',
  'settings.yml',
  'settings.yaml',
  'settings.json',
  'plugin.yml',
];

// File patterns that indicate custom user configuration worth preserving.
const CUSTOM_CONFIG_EXTENSIONS = new Set([
  '.yml',
  '.yaml',
  '.json',
  '.toml',
  '.properties',
  '.cfg',
  '.conf',
  '.ini',
]);

@Injectable()
export class PluginConfigDiscoveryService {
  private readonly logger = new Logger(PluginConfigDiscoveryService.name);

  constructor(private readonly fileManager: FileManagerService) {}

  /**
   * Discover config files for a given plugin.
   * Scans plugins/{pluginKey}/ directory for known config patterns.
   */
  async discover(
    serverId: string,
    pluginKey: string,
  ): Promise<PluginConfigDiscovery> {
    const configDir = `${PLUGINS_DIR}/${pluginKey}`;
    const configDirExists = await this.checkDirExists(serverId, configDir);

    if (!configDirExists) {
      return {
        configDir,
        configDirExists: false,
        mainConfigFile: null,
        configFiles: [],
        hasConfigOverride: false,
        versionReplacementRisk: VersionReplacementRisk.NONE,
      };
    }

    const entries = await this.scanConfigDir(serverId, configDir);
    const mainConfigFile = this.findMainConfig(entries);
    const configFiles = entries.filter((e) => this.isConfigFile(e.name));
    const hasConfigOverride = configFiles.length > 0;
    const versionReplacementRisk = this.assessVersionReplacementRisk(
      configFiles,
      mainConfigFile,
    );

    return {
      configDir,
      configDirExists: true,
      mainConfigFile,
      configFiles,
      hasConfigOverride,
      versionReplacementRisk,
    };
  }

  /**
   * Batch discover configs for multiple plugins.
   */
  async discoverBatch(
    serverId: string,
    pluginKeys: readonly string[],
  ): Promise<Map<string, PluginConfigDiscovery>> {
    const results = new Map<string, PluginConfigDiscovery>();
    // Run discoveries in parallel for better performance.
    const promises = pluginKeys.map(async (key) => {
      const discovery = await this.discover(serverId, key);
      results.set(key, discovery);
    });
    await Promise.allSettled(promises);
    return results;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async checkDirExists(
    serverId: string,
    dirPath: string,
  ): Promise<boolean> {
    try {
      const stat = await this.fileManager.stat(serverId, dirPath);
      return stat.isDirectory;
    } catch (_err) {
      return false;
    }
  }

  private async scanConfigDir(
    serverId: string,
    dirPath: string,
  ): Promise<PluginConfigEntry[]> {
    try {
      const rawEntries = await this.fileManager.listDir(serverId, dirPath);
      return rawEntries
        .filter((e) => !e.isDirectory && this.isConfigFile(e.name))
        .map((e) => this.toConfigEntry(e));
    } catch (err) {
      this.logger.warn(
        `Failed to scan config dir ${dirPath} for server ${serverId}: ${err}`,
      );
      return [];
    }
  }

  private toConfigEntry(entry: FileEntry): PluginConfigEntry {
    return {
      path: entry.path,
      name: entry.name,
      size: entry.size,
      modifiedAt: entry.modifiedAt,
    };
  }

  /** Check if a filename looks like a plugin config file. */
  private isConfigFile(filename: string): boolean {
    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx < 0) return false;
    const ext = filename.substring(dotIdx).toLowerCase();
    return CUSTOM_CONFIG_EXTENSIONS.has(ext);
  }

  /** Find the main config file from candidates, or fallback to first config. */
  private findMainConfig(
    entries: PluginConfigEntry[],
  ): PluginConfigEntry | null {
    if (entries.length === 0) return null;

    // Exact match against well-known main config names.
    for (const candidate of MAIN_CONFIG_CANDIDATES) {
      const match = entries.find(
        (e) => e.name.toLowerCase() === candidate,
      );
      if (match) return match;
    }

    // Fallback: pick the first config file as main.
    return entries[0];
  }

  /**
   * Assess version replacement risk based on existing config files.
   * Risk is higher when user has customized configs that might be
   * incompatible with the new plugin version.
   */
  private assessVersionReplacementRisk(
    configFiles: readonly PluginConfigEntry[],
    mainConfigFile: PluginConfigEntry | null,
  ): VersionReplacementRisk {
    if (configFiles.length === 0) {
      return VersionReplacementRisk.NONE;
    }

    // Only a main config (no custom overrides) — low risk.
    if (configFiles.length === 1 && mainConfigFile) {
      return VersionReplacementRisk.LOW;
    }

    // Multiple config files indicate custom configuration — medium risk.
    if (configFiles.length <= 3) {
      return VersionReplacementRisk.MEDIUM;
    }

    // Many config files — high risk of version incompatibility.
    return VersionReplacementRisk.HIGH;
  }
}

import type { PluginInstallState } from '@jian-agent/shared-domain';

/**
 * Raw plugin descriptor extracted from plugin.yml / paper-plugin.yml inside a JAR.
 */
export interface PluginDescriptor {
  readonly name: string;
  readonly version: string;
  readonly authors: readonly string[];
  readonly description?: string;
  readonly main?: string;
  readonly apiVersion?: string;
  readonly depend?: readonly string[];
  readonly softDepend?: readonly string[];
  readonly website?: string;
}

/**
 * A single plugin entry discovered on disk.
 */
export interface DiskPluginEntry {
  /** Unique key — lowercase plugin name from plugin.yml, or filename stem if YAML is missing. */
  readonly key: string;
  /** Filename on disk, e.g. "MyPlugin.jar" or "MyPlugin.jar.disabled". */
  readonly filename: string;
  /** Relative path from the plugins root, e.g. "plugins/MyPlugin.jar". */
  readonly path: string;
  /** Whether the file ends with .disabled (or is otherwise disabled on disk). */
  readonly disabledOnDisk: boolean;
  /** Parsed descriptor from plugin.yml / paper-plugin.yml. Null if YAML is missing or unreadable. */
  readonly descriptor: PluginDescriptor | null;
  /** Derived install state based on disk presence. */
  readonly installState: PluginInstallState;
}

/**
 * Abstract scanner — discovers plugins on a server's filesystem.
 */
export interface PluginScanner {
  /**
   * Scan the plugins directory for the given server and return all discovered entries.
   * @param serverId Target server identifier.
   */
  scan(serverId: string): Promise<readonly DiskPluginEntry[]>;
}

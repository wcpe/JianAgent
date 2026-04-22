import type { PluginInstallState } from '../enums/plugin-install-state.js';
import type { PluginRuntimeState } from '../enums/plugin-runtime-state.js';

export interface PluginConfigFileDto {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: string;
}

export type VersionReplacementRisk = 'none' | 'low' | 'medium' | 'high';

export interface PluginMetadataDto {
  readonly name: string;
  readonly version: string;
  readonly authors: readonly string[];
  readonly dependencies: readonly string[];
  readonly mainClass: string;
  readonly filename: string;
  readonly configDir: string;
  readonly installState: PluginInstallState;
  readonly runtimeState: PluginRuntimeState;
  readonly requiresRestart: boolean;
  readonly riskWarnings: readonly string[];
  /** Discovered config files in the plugin's config directory. */
  readonly configFiles: readonly PluginConfigFileDto[];
  /** Main config file entry, if found. */
  readonly mainConfigFile: PluginConfigFileDto | null;
  /** Whether the plugin has custom config overrides on disk. */
  readonly hasConfigOverride: boolean;
  /** Risk level when replacing the plugin version with config overrides present. */
  readonly versionReplacementRisk: VersionReplacementRisk;
}

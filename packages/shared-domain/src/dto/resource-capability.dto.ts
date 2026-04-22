/**
 * Capability flags for a resource — each section describes
 * what operations are available for that resource in the UI / API.
 */

export interface TerminalCapabilityDto {
  readonly enabled: boolean;
  /** Max concurrent terminal sessions allowed, null = unlimited. */
  readonly maxSessions: number | null;
}

export interface FileCapabilityDto {
  readonly enabled: boolean;
  /** Base path for file operations on the resource. */
  readonly rootPath: string | null;
}

export interface PluginCapabilityDto {
  readonly enabled: boolean;
  readonly pluginCount: number;
}

export interface LogCapabilityDto {
  readonly enabled: boolean;
  readonly collectionCount: number;
}

export interface AuditCapabilityDto {
  readonly enabled: boolean;
}

export interface JvmCapabilityDto {
  readonly enabled: boolean;
  /** Whether the Java helper agent is attached. */
  readonly helperAttached: boolean;
  /** Whether JFR recording is supported. */
  readonly jfrSupported: boolean;
}

export interface MonitoringCapabilityDto {
  readonly enabled: boolean;
  /** Whether probe-based monitoring is active. */
  readonly probeActive: boolean;
  /** Whether JMX monitoring is configured. */
  readonly jmxEnabled: boolean;
  /** Active alert rule count. */
  readonly alertRuleCount: number;
}

export interface ValidationCapabilityDto {
  readonly enabled: boolean;
}

export interface MinecraftCapabilityDto {
  readonly enabled: boolean;
  /** Whether the server is a Minecraft server. */
  readonly isMinecraft: boolean;
  /** Server version (e.g., "1.20.4"). */
  readonly serverVersion: string | null;
  /** Whether probe is connected. */
  readonly probeConnected: boolean;
}

export interface ResourceCapabilityDto {
  readonly terminal: TerminalCapabilityDto;
  readonly files: FileCapabilityDto;
  readonly plugins: PluginCapabilityDto;
  readonly logs: LogCapabilityDto;
  readonly audit: AuditCapabilityDto;
  readonly jvm: JvmCapabilityDto;
  readonly minecraft: MinecraftCapabilityDto;
  readonly monitoring: MonitoringCapabilityDto;
  readonly validation: ValidationCapabilityDto;
}

/**
 * JVM target descriptors — defines the various ways a JVM instance
 * can be reached and operated on.
 */

/** Target identification for a managed server JVM. */
export interface ManagedServerTargetDto {
  readonly kind: 'managed-server';
  /** Unique server identifier in the platform. */
  readonly serverId: string;
  /** Server display name for UI. */
  readonly serverName: string;
  /** Host where the server is running. */
  readonly hostId: string;
}

/** Target identification for an external JVM by PID. */
export interface ExternalPidTargetDto {
  readonly kind: 'external-pid';
  /** Process ID of the target JVM. */
  readonly pid: string;
  /** Host where the JVM process is running. */
  readonly hostId: string;
  /** Main class name or jar path (if known). */
  readonly mainClass?: string;
}

/** Target identification for a probe-connected JVM. */
export interface ProbeConnectedTargetDto {
  readonly kind: 'probe-connected';
  /** Unique probe identifier. */
  readonly probeId: string;
  /** Server or application associated with the probe. */
  readonly applicationId: string;
  /** Whether the probe connection is currently active. */
  readonly connected: boolean;
}

/**
 * Discriminated union of JVM target types.
 * Each variant specifies how the target JVM is reached.
 */
export type JvmTargetDto =
  | ManagedServerTargetDto
  | ExternalPidTargetDto
  | ProbeConnectedTargetDto;

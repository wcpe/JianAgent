/** Describes a JVM target — either local PID, remote host, or JMX URL */
export interface JvmTargetDescriptor {
  /** Local JVM process ID */
  pid?: string;
  /** Remote host address */
  host?: string;
  /** Remote host SSH port */
  port?: number;
  /** Direct JMX service URL */
  jmxUrl?: string;
  /** Human-readable label */
  label?: string;
}

/** Metadata describing a single JVM capability */
export interface CapabilityDescriptor {
  /** Unique capability name (e.g. "thread-dump", "heap-histogram") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Which provider implements this capability */
  provider: string;
  /** Whether this capability requires an active attachment */
  requiresAttachment: boolean;
  /** Optional parameter schema for the operation */
  parameters?: CapabilityParameter[];
}

/** Parameter metadata for a capability operation */
export interface CapabilityParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

/** An operation to execute via a capability provider */
export interface CapabilityOperation {
  /** Capability name to invoke */
  name: string;
  /** Which provider to route to */
  provider: string;
  /** Operation-specific parameters */
  params?: Record<string, unknown>;
}

/** Result of a capability operation */
export interface OperationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Timestamp of the operation */
  timestamp?: string;
}

/** Interface implemented by all capability providers */
export interface CapabilityProvider {
  readonly providerName: string;
  describeCapabilities(): CapabilityDescriptor[];
  execute(target: JvmTargetDescriptor, operation: CapabilityOperation): Promise<OperationResult>;
}

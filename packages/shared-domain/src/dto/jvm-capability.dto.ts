/**
 * JVM capability descriptors — declares which JVM diagnostic
 * operations are available for a given resource or target.
 */

/** Core attach capabilities for the Java helper agent. */
export interface JvmAttachCapabilityDto {
  readonly enabled: boolean;
  /** Whether auto-attach to discovered JVMs is supported. */
  readonly autoAttach: boolean;
  /** Supported JDK vendor(s), e.g. ['oracle', 'openjdk', 'temurin']. */
  readonly supportedVendors: readonly string[];
}

/** JMX (Java Management Extensions) monitoring capability. */
export interface JvmJmxCapabilityDto {
  readonly enabled: boolean;
  /** Whether remote JMX connector is available. */
  readonly remoteConnector: boolean;
  /** Configured JMX port (null if not yet assigned). */
  readonly port: number | null;
  /** Whether JMX authentication is required. */
  readonly authRequired: boolean;
}

/** JFR (Java Flight Recorder) recording capability. */
export interface JvmJfrCapabilityDto {
  readonly enabled: boolean;
  /** Maximum recording duration in seconds (0 = unlimited). */
  readonly maxDurationSec: number;
  /** Whether continuous background recording is supported. */
  readonly continuousRecording: boolean;
  /** Supported JFR event types. */
  readonly supportedEvents: readonly string[];
}

/** Diagnostic probe injection capability. */
export interface JvmProbeCapabilityDto {
  readonly enabled: boolean;
  /** Whether bytecode instrumentation is available. */
  readonly bytecodeInstrumentation: boolean;
  /** Maximum concurrent probes allowed. */
  readonly maxConcurrentProbes: number;
  /** Supported probe categories (e.g. 'method-trace', 'exception-watch'). */
  readonly supportedCategories: readonly string[];
}

/** Console command execution capability (e.g. jstack, jmap). */
export interface JvmConsoleCommandCapabilityDto {
  readonly enabled: boolean;
  /** Whitelist of allowed console commands. */
  readonly allowedCommands: readonly string[];
  /** Whether command output streaming is supported. */
  readonly streaming: boolean;
}

/** Script evaluation capability (e.g. via JShell or embedded scripting). */
export interface JvmEvalScriptCapabilityDto {
  readonly enabled: boolean;
  /** Supported script languages. */
  readonly supportedLanguages: readonly string[];
  /** Maximum script execution timeout in seconds. */
  readonly timeoutSec: number;
}

/**
 * Composite JVM capability descriptor.
 * Aggregates all JVM-specific capabilities for a resource.
 */
export interface JvmCapabilityDescriptorDto {
  readonly attach: JvmAttachCapabilityDto;
  readonly jmx: JvmJmxCapabilityDto;
  readonly jfr: JvmJfrCapabilityDto;
  readonly probe: JvmProbeCapabilityDto;
  readonly consoleCommand: JvmConsoleCommandCapabilityDto;
  readonly evalScript: JvmEvalScriptCapabilityDto;
}

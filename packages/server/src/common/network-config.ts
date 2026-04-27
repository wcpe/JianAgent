type EnvMap = Record<string, string | undefined>;

export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const DEFAULT_SERVER_PORT = 3400;
export const DEFAULT_PLUGIN_BRIDGE_PORT = 3401;
const DEFAULT_START_READY_MODE = 'hybrid';
const DEFAULT_START_READY_TIMEOUT_MS = 30_000;
const DEFAULT_START_RETRY_ATTEMPTS = 1;
const DEFAULT_START_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_START_RETRY_MAX_DELAY_MS = 8_000;
const DEFAULT_START_PORT_CHECK_TIMEOUT_MS = 20_000;
const DEFAULT_START_PORT_CHECK_INTERVAL_MS = 500;
const DEFAULT_STOP_TIMEOUT_MS = 30_000;

function readHost(value: string | undefined): string {
  return value?.trim() || DEFAULT_SERVER_HOST;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return fallback;
}

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

type StartReadyMode = 'output' | 'port' | 'hybrid';

function readStartReadyMode(value: string | undefined): StartReadyMode {
  if (value === 'output' || value === 'port' || value === 'hybrid') {
    return value;
  }
  return DEFAULT_START_READY_MODE;
}

export interface StartReadyConfig {
  readonly mode: StartReadyMode;
  readonly timeoutMs: number;
  readonly portCheckTimeoutMs: number;
  readonly portCheckIntervalMs: number;
  readonly stopTimeoutMs: number;
}

export interface StartPolicyConfig extends StartReadyConfig {
  readonly startRetryAttempts: number;
  readonly startRetryBaseDelayMs: number;
  readonly startRetryMaxDelayMs: number;
}

export function readServerConfig(env: EnvMap = process.env): { host: string; port: number } {
  return {
    host: readHost(env['HOST']),
    port: readPort(env['PORT'], DEFAULT_SERVER_PORT),
  };
}

export function readPluginBridgeConfig(
  env: EnvMap = process.env,
): { disabled: boolean; host: string; port: number } {
  return {
    disabled: readBoolean(env['PLUGIN_BRIDGE_DISABLED']),
    host: readHost(env['PLUGIN_BRIDGE_HOST']),
    port: readPort(env['PLUGIN_BRIDGE_PORT'], DEFAULT_PLUGIN_BRIDGE_PORT),
  };
}

export function readStartReadyConfig(env: EnvMap = process.env): StartReadyConfig {
  return {
    mode: readStartReadyMode(env['START_READY_MODE']),
    timeoutMs: readPositiveInteger(env['START_READY_TIMEOUT_MS'], DEFAULT_START_READY_TIMEOUT_MS),
    portCheckTimeoutMs: readPositiveInteger(env['START_PORT_CHECK_TIMEOUT_MS'], DEFAULT_START_PORT_CHECK_TIMEOUT_MS),
    portCheckIntervalMs: readPositiveInteger(env['START_PORT_CHECK_INTERVAL_MS'], DEFAULT_START_PORT_CHECK_INTERVAL_MS),
    stopTimeoutMs: readPositiveInteger(env['STOP_TIMEOUT_MS'], DEFAULT_STOP_TIMEOUT_MS),
  };
}

export function readStartPolicyConfig(env: EnvMap = process.env): StartPolicyConfig {
  const ready = readStartReadyConfig(env);
  return {
    ...ready,
    startRetryAttempts: readPositiveInteger(env['START_RETRY_ATTEMPTS'], DEFAULT_START_RETRY_ATTEMPTS),
    startRetryBaseDelayMs: readPositiveInteger(env['START_RETRY_BASE_DELAY_MS'], DEFAULT_START_RETRY_BASE_DELAY_MS),
    startRetryMaxDelayMs: readPositiveInteger(env['START_RETRY_MAX_DELAY_MS'], DEFAULT_START_RETRY_MAX_DELAY_MS),
  };
}

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:5174', 'http://127.0.0.1:5174',
  'http://localhost:5175', 'http://127.0.0.1:5175',
  'http://localhost:5176', 'http://127.0.0.1:5176',
];

export interface CorsConfig {
  readonly origins: string[];
}

export function readCorsConfig(env: EnvMap = process.env): CorsConfig {
  const raw = env['CORS_ORIGINS']?.trim();
  if (raw) {
    const origins = raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    return { origins };
  }

  const isProd = env['NODE_ENV'] === 'production';
  if (isProd) {
    return { origins: [] };
  }

  return { origins: DEFAULT_DEV_CORS_ORIGINS };
}

export interface RealtimeConfig {
  readonly maxConnections: number;
  readonly outputAggregateWindowMs: number;
  readonly outputDedupWindowMs: number;
  readonly outputDedupTtlMs: number;
  readonly dedupCleanupIntervalMs: number;
}

export function readRealtimeConfig(env: EnvMap = process.env): RealtimeConfig {
  return {
    maxConnections: readPositiveInteger(env['REALTIME_MAX_CONNECTIONS'], 200),
    outputAggregateWindowMs: readPositiveInteger(env['REALTIME_OUTPUT_AGGREGATE_WINDOW_MS'], 100),
    outputDedupWindowMs: readPositiveInteger(env['REALTIME_OUTPUT_DEDUP_WINDOW_MS'], 120),
    outputDedupTtlMs: readPositiveInteger(env['REALTIME_OUTPUT_DEDUP_TTL_MS'], 5 * 60 * 1000),
    dedupCleanupIntervalMs: readPositiveInteger(env['REALTIME_DEDUP_CLEANUP_INTERVAL_MS'], 60_000),
  };
}

export interface AuthRateLimitConfig {
  readonly maxLoginAttempts: number;
  readonly loginWindowMs: number;
}

export function readAuthRateLimitConfig(env: EnvMap = process.env): AuthRateLimitConfig {
  return {
    maxLoginAttempts: readPositiveInteger(env['AUTH_MAX_LOGIN_ATTEMPTS'], 10),
    loginWindowMs: readPositiveInteger(env['AUTH_LOGIN_WINDOW_MS'], 15 * 60 * 1000),
  };
}

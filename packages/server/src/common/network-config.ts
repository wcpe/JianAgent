type EnvMap = Record<string, string | undefined>;

export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const DEFAULT_SERVER_PORT = 3400;
export const DEFAULT_PLUGIN_BRIDGE_PORT = 3401;

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

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLUGIN_BRIDGE_PORT,
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PORT,
  readPluginBridgeConfig,
  readServerConfig,
} from '../network-config.js';

describe('network-config', () => {
  it('uses safe default development ports outside the reserved 3000 range', () => {
    expect(DEFAULT_SERVER_HOST).toBe('127.0.0.1');
    expect(DEFAULT_SERVER_PORT).toBe(3400);
    expect(DEFAULT_PLUGIN_BRIDGE_PORT).toBe(3401);
    expect(readServerConfig({})).toEqual({ host: '127.0.0.1', port: 3400 });
    expect(readPluginBridgeConfig({})).toEqual({
      disabled: false,
      host: '127.0.0.1',
      port: 3401,
    });
  });

  it('respects explicit environment overrides and falls back on invalid ports', () => {
    expect(readServerConfig({ HOST: '0.0.0.0', PORT: '4400' })).toEqual({
      host: '0.0.0.0',
      port: 4400,
    });
    expect(readServerConfig({ PORT: 'invalid' })).toEqual({ host: '127.0.0.1', port: 3400 });

    expect(readPluginBridgeConfig({
      PLUGIN_BRIDGE_DISABLED: 'true',
      PLUGIN_BRIDGE_HOST: '0.0.0.0',
      PLUGIN_BRIDGE_PORT: '4401',
    })).toEqual({
      disabled: true,
      host: '0.0.0.0',
      port: 4401,
    });
    expect(readPluginBridgeConfig({ PLUGIN_BRIDGE_PORT: '99999' })).toEqual({
      disabled: false,
      host: '127.0.0.1',
      port: 3401,
    });
  });
});

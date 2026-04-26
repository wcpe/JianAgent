import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLUGIN_BRIDGE_PORT,
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PORT,
  readPluginBridgeConfig,
  readServerConfig,
  readRealtimeConfig,
  readAuthRateLimitConfig,
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

describe('readRealtimeConfig', () => {
  it('should use default values when env vars not set', () => {
    expect(readRealtimeConfig({})).toEqual({
      maxConnections: 200,
      outputAggregateWindowMs: 100,
      outputDedupWindowMs: 120,
      outputDedupTtlMs: 300000,
      dedupCleanupIntervalMs: 60000,
    });
  });

  it('should respect environment overrides', () => {
    expect(readRealtimeConfig({
      REALTIME_MAX_CONNECTIONS: '500',
      REALTIME_OUTPUT_AGGREGATE_WINDOW_MS: '200',
      REALTIME_OUTPUT_DEDUP_WINDOW_MS: '150',
      REALTIME_OUTPUT_DEDUP_TTL_MS: '600000',
      REALTIME_DEDUP_CLEANUP_INTERVAL_MS: '120000',
    })).toEqual({
      maxConnections: 500,
      outputAggregateWindowMs: 200,
      outputDedupWindowMs: 150,
      outputDedupTtlMs: 600000,
      dedupCleanupIntervalMs: 120000,
    });
  });

  it('should fallback to defaults on invalid values', () => {
    expect(readRealtimeConfig({
      REALTIME_MAX_CONNECTIONS: 'invalid',
      REALTIME_OUTPUT_AGGREGATE_WINDOW_MS: '-100',
      REALTIME_OUTPUT_DEDUP_WINDOW_MS: '0',
    })).toEqual({
      maxConnections: 200,
      outputAggregateWindowMs: 100,
      outputDedupWindowMs: 120,
      outputDedupTtlMs: 300000,
      dedupCleanupIntervalMs: 60000,
    });
  });
});

describe('readAuthRateLimitConfig', () => {
  it('should use default values when env vars not set', () => {
    expect(readAuthRateLimitConfig({})).toEqual({
      maxLoginAttempts: 10,
      loginWindowMs: 900000,
    });
  });

  it('should respect environment overrides', () => {
    expect(readAuthRateLimitConfig({
      AUTH_MAX_LOGIN_ATTEMPTS: '5',
      AUTH_LOGIN_WINDOW_MS: '600000',
    })).toEqual({
      maxLoginAttempts: 5,
      loginWindowMs: 600000,
    });
  });

  it('should fallback to defaults on invalid values', () => {
    expect(readAuthRateLimitConfig({
      AUTH_MAX_LOGIN_ATTEMPTS: 'invalid',
      AUTH_LOGIN_WINDOW_MS: '-1000',
    })).toEqual({
      maxLoginAttempts: 10,
      loginWindowMs: 900000,
    });
  });
});

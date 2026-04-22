import { describe, it, expect } from 'vitest';
import { HandshakeService } from '../handshake.service.js';
import { PLUGIN_PROTOCOL_VERSION } from '@jian-agent/shared-protocol';

describe('HandshakeService', () => {
  const service = new HandshakeService();

  it('should accept matching protocol version', () => {
    const result = service.validate({
      protocolVersion: PLUGIN_PROTOCOL_VERSION,
      serverId: 'test-server-id',
      pluginVersion: '1.0.0',
      serverVersion: '1.20.1',
    });
    expect(result.accepted).toBe(true);
    expect(result.protocolVersion).toBe(PLUGIN_PROTOCOL_VERSION);
    expect(result.reason).toBeUndefined();
  });

  it('should reject mismatched protocol version', () => {
    const result = service.validate({
      protocolVersion: 999,
      serverId: 'test-server-id',
      pluginVersion: '1.0.0',
      serverVersion: '1.20.1',
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('mismatch');
  });
});

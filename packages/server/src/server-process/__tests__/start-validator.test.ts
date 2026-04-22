import { describe, it, expect, beforeEach } from 'vitest';
import { StartValidatorService } from '../lifecycle/start-validator.service.js';

describe('StartValidatorService', () => {
  let validator: StartValidatorService;

  beforeEach(() => {
    validator = new StartValidatorService();
  });

  it('should reject config with missing jarPath', async () => {
    const result = await validator.validate({
      id: 'srv-1',
      jarPath: '/nonexistent/server.jar',
      workDir: '/tmp/test-workdir',
      javaPath: 'java',
      jvmArgs: [],
      serverArgs: [],
      host: 'localhost',
      port: 25565,
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'jarPath', severity: 'error' }),
      ])
    );
  });

  it('should pass validation for valid config', async () => {
    const result = await validator.validate({
      id: 'srv-3',
      jarPath: __filename,
      workDir: '/tmp',
      javaPath: 'java',
      jvmArgs: ['-Xmx2G'],
      serverArgs: ['nogui'],
      host: 'localhost',
      port: 25599,
    } as any);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn about invalid jvmArgs format', async () => {
    const result = await validator.validate({
      id: 'srv-4',
      jarPath: __filename,
      workDir: '/tmp',
      javaPath: 'java',
      jvmArgs: ['-Xmxinvalid'],
      serverArgs: [],
      host: 'localhost',
      port: 25598,
    } as any);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'jvmArgs', severity: 'warning' }),
      ])
    );
  });
});

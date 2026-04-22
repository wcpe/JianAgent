import { describe, expect, it } from 'vitest';
import { PlatformRuntimeController } from '../platform-runtime.controller.js';

describe('PlatformRuntimeController', () => {
  it('exposes phase-5 runtime capability modes', () => {
    const controller = new PlatformRuntimeController({
      getCapabilities: () => ({
        storageDialect: 'sqlite',
        logBackendMode: 'hybrid',
        probeRuntimeKind: 'paper-1.20.4',
        realtimeCapacityMode: 'standard',
      }),
    } as any);

    expect(controller.getCapabilities()).toEqual({
      storageDialect: 'sqlite',
      logBackendMode: 'hybrid',
      probeRuntimeKind: 'paper-1.20.4',
      realtimeCapacityMode: 'standard',
    });
  });
});

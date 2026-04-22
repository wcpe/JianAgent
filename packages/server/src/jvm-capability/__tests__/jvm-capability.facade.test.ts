import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JvmCapabilityRegistry } from '../jvm-capability.registry.js';
import type {
  CapabilityProvider,
  CapabilityDescriptor,
  JvmTargetDescriptor,
  CapabilityOperation,
  OperationResult,
} from '../jvm-capability.types.js';

// --- Mock Provider Factory ---

function createMockProvider(
  name: string,
  capabilities: CapabilityDescriptor[],
): CapabilityProvider & { executeMock: ReturnType<typeof vi.fn> } {
  const executeMock = vi.fn().mockResolvedValue({
    success: true,
    data: { provider: name },
    timestamp: new Date().toISOString(),
  });

  return {
    providerName: name,
    describeCapabilities: () => capabilities,
    execute: executeMock,
    executeMock,
  };
}

// --- Fixtures ---

const javaHelperCaps: CapabilityDescriptor[] = [
  {
    name: 'thread-dump',
    description: 'Capture thread dump',
    provider: 'java-helper',
    requiresAttachment: true,
  },
  {
    name: 'heap-histogram',
    description: 'Capture heap histogram',
    provider: 'java-helper',
    requiresAttachment: true,
  },
];

const probeCaps: CapabilityDescriptor[] = [
  {
    name: 'jmx-query',
    description: 'Query JMX MBeans',
    provider: 'probe',
    requiresAttachment: false,
    parameters: [
      { name: 'objectName', type: 'string', required: true, description: 'MBean pattern' },
    ],
  },
  {
    name: 'gc-info',
    description: 'GC statistics',
    provider: 'probe',
    requiresAttachment: false,
  },
  {
    name: 'vm-overview',
    description: 'JVM overview',
    provider: 'probe',
    requiresAttachment: false,
  },
];

const externalAttachCaps: CapabilityDescriptor[] = [
  {
    name: 'jstack',
    description: 'Thread dump via jstack',
    provider: 'external-attach',
    requiresAttachment: false,
  },
  {
    name: 'jmap-histogram',
    description: 'Heap histogram via jmap',
    provider: 'external-attach',
    requiresAttachment: false,
  },
];

// --- Tests ---

describe('JvmCapabilityRegistry', () => {
  let registry: JvmCapabilityRegistry;
  let javaHelperProvider: ReturnType<typeof createMockProvider>;
  let probeProvider: ReturnType<typeof createMockProvider>;
  let externalAttachProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    javaHelperProvider = createMockProvider('java-helper', javaHelperCaps);
    probeProvider = createMockProvider('probe', probeCaps);
    externalAttachProvider = createMockProvider('external-attach', externalAttachCaps);

    registry = new JvmCapabilityRegistry(
      javaHelperProvider as any,
      probeProvider as any,
      externalAttachProvider as any,
    );
    registry.onModuleInit();
  });

  // --- Provider Registration ---

  describe('getProviders', () => {
    it('should return all three registered providers', () => {
      const providers = registry.getProviders();
      expect(providers).toHaveLength(3);
      expect(providers.map((p) => p.providerName)).toEqual([
        'java-helper',
        'probe',
        'external-attach',
      ]);
    });
  });

  describe('getProvider', () => {
    it('should return a provider by name', () => {
      const provider = registry.getProvider('probe');
      expect(provider).toBeDefined();
      expect(provider!.providerName).toBe('probe');
    });

    it('should return undefined for unknown provider name', () => {
      const provider = registry.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });
  });

  // --- Capability Aggregation ---

  describe('listAllCapabilities', () => {
    it('should aggregate capabilities from all providers', () => {
      const caps = registry.listAllCapabilities();
      expect(caps).toHaveLength(javaHelperCaps.length + probeCaps.length + externalAttachCaps.length);
    });

    it('should include capabilities from each provider', () => {
      const caps = registry.listAllCapabilities();
      const capNames = caps.map((c) => c.name);

      expect(capNames).toContain('thread-dump');
      expect(capNames).toContain('heap-histogram');
      expect(capNames).toContain('jmx-query');
      expect(capNames).toContain('gc-info');
      expect(capNames).toContain('vm-overview');
      expect(capNames).toContain('jstack');
      expect(capNames).toContain('jmap-histogram');
    });

    it('should preserve provider attribution on each capability', () => {
      const caps = registry.listAllCapabilities();
      const threadDump = caps.find((c) => c.name === 'thread-dump');
      const jmxQuery = caps.find((c) => c.name === 'jmx-query');
      const jstack = caps.find((c) => c.name === 'jstack');

      expect(threadDump!.provider).toBe('java-helper');
      expect(jmxQuery!.provider).toBe('probe');
      expect(jstack!.provider).toBe('external-attach');
    });

    it('should preserve requiresAttachment flag', () => {
      const caps = registry.listAllCapabilities();
      const threadDump = caps.find((c) => c.name === 'thread-dump');
      const jmxQuery = caps.find((c) => c.name === 'jmx-query');

      expect(threadDump!.requiresAttachment).toBe(true);
      expect(jmxQuery!.requiresAttachment).toBe(false);
    });

    it('should preserve parameter metadata', () => {
      const caps = registry.listAllCapabilities();
      const jmxQuery = caps.find((c) => c.name === 'jmx-query');

      expect(jmxQuery!.parameters).toBeDefined();
      expect(jmxQuery!.parameters![0].name).toBe('objectName');
      expect(jmxQuery!.parameters![0].required).toBe(true);
    });
  });

  // --- Execution Routing ---

  describe('execute', () => {
    it('should route operation to the correct provider', async () => {
      const target: JvmTargetDescriptor = { pid: '1234' };
      const operation: CapabilityOperation = {
        name: 'thread-dump',
        provider: 'java-helper',
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(true);
      expect(javaHelperProvider.executeMock).toHaveBeenCalledWith(target, operation);
      expect(probeProvider.executeMock).not.toHaveBeenCalled();
      expect(externalAttachProvider.executeMock).not.toHaveBeenCalled();
    });

    it('should route to probe provider for JMX operations', async () => {
      const target: JvmTargetDescriptor = { jmxUrl: 'service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi' };
      const operation: CapabilityOperation = {
        name: 'jmx-query',
        provider: 'probe',
        params: { objectName: 'java.lang:type=Memory' },
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(true);
      expect(probeProvider.executeMock).toHaveBeenCalledWith(target, operation);
    });

    it('should route to external-attach provider for jstack', async () => {
      const target: JvmTargetDescriptor = { pid: '5678' };
      const operation: CapabilityOperation = {
        name: 'jstack',
        provider: 'external-attach',
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(true);
      expect(externalAttachProvider.executeMock).toHaveBeenCalledWith(target, operation);
    });

    it('should return error for unknown provider', async () => {
      const target: JvmTargetDescriptor = { pid: '1234' };
      const operation: CapabilityOperation = {
        name: 'some-op',
        provider: 'nonexistent-provider',
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown capability provider: nonexistent-provider');
    });

    it('should catch provider execution errors', async () => {
      javaHelperProvider.executeMock.mockRejectedValueOnce(new Error('Attach failed'));

      const target: JvmTargetDescriptor = { pid: '1234' };
      const operation: CapabilityOperation = {
        name: 'thread-dump',
        provider: 'java-helper',
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Attach failed');
    });

    it('should handle non-Error thrown values', async () => {
      javaHelperProvider.executeMock.mockRejectedValueOnce('string error');

      const target: JvmTargetDescriptor = { pid: '1234' };
      const operation: CapabilityOperation = {
        name: 'thread-dump',
        provider: 'java-helper',
      };

      const result = await registry.execute(target, operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  // --- Provider Count Verification ---

  describe('three-provider architecture', () => {
    it('should have exactly java-helper, probe, and external-attach providers', () => {
      const providerNames = registry.getProviders().map((p) => p.providerName);
      expect(providerNames).toEqual(['java-helper', 'probe', 'external-attach']);
    });

    it('java-helper provider should have attachment-required capabilities', () => {
      const caps = javaHelperProvider.describeCapabilities();
      expect(caps.every((c) => c.requiresAttachment)).toBe(true);
    });

    it('probe provider should have non-attachment capabilities', () => {
      const caps = probeProvider.describeCapabilities();
      expect(caps.every((c) => !c.requiresAttachment)).toBe(true);
    });

    it('external-attach provider should have non-attachment capabilities', () => {
      const caps = externalAttachProvider.describeCapabilities();
      expect(caps.every((c) => !c.requiresAttachment)).toBe(true);
    });
  });
});

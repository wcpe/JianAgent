import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { CapabilityProvider, CapabilityDescriptor, JvmTargetDescriptor, CapabilityOperation, OperationResult } from './jvm-capability.types.js';
import { JavaHelperCapabilityProvider } from './providers/java-helper-capability.provider.js';
import { ProbeCapabilityProvider } from './providers/probe-capability.provider.js';
import { ExternalAttachProvider } from './providers/external-attach.provider.js';

@Injectable()
export class JvmCapabilityRegistry implements OnModuleInit {
  private readonly logger = new Logger(JvmCapabilityRegistry.name);
  private readonly providers = new Map<string, CapabilityProvider>();

  constructor(
    private readonly javaHelperProvider: JavaHelperCapabilityProvider,
    private readonly probeProvider: ProbeCapabilityProvider,
    private readonly externalAttachProvider: ExternalAttachProvider,
  ) {}

  onModuleInit(): void {
    this.register(this.javaHelperProvider);
    this.register(this.probeProvider);
    this.register(this.externalAttachProvider);
    this.logger.log(`Registered ${this.providers.size} capability providers`);
  }

  private register(provider: CapabilityProvider): void {
    this.providers.set(provider.providerName, provider);
  }

  /** Get all registered providers */
  getProviders(): CapabilityProvider[] {
    return [...this.providers.values()];
  }

  /** Get a provider by name */
  getProvider(name: string): CapabilityProvider | undefined {
    return this.providers.get(name);
  }

  /** List all capabilities across all providers */
  listAllCapabilities(): CapabilityDescriptor[] {
    const caps: CapabilityDescriptor[] = [];
    for (const provider of this.providers.values()) {
      caps.push(...provider.describeCapabilities());
    }
    return caps;
  }

  /** Execute a capability operation, routing to the correct provider */
  async execute(target: JvmTargetDescriptor, operation: CapabilityOperation): Promise<OperationResult> {
    const provider = this.providers.get(operation.provider);
    if (!provider) {
      return {
        success: false,
        error: `Unknown capability provider: ${operation.provider}`,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      return await provider.execute(target, operation);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Operation "${operation.name}" failed on provider "${operation.provider}": ${message}`);
      return { success: false, error: message, timestamp: new Date().toISOString() };
    }
  }
}

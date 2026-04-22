import { Injectable, Logger } from '@nestjs/common';
import type { JvmTargetDescriptor, CapabilityDescriptor } from './jvm-capability.types.js';
import { JavaHelperCapabilityProvider } from './providers/java-helper-capability.provider.js';
import { ProbeCapabilityProvider } from './providers/probe-capability.provider.js';
import { ExternalAttachProvider } from './providers/external-attach.provider.js';

@Injectable()
export class JvmTargetResolver {
  private readonly logger = new Logger(JvmTargetResolver.name);

  constructor(
    private readonly javaHelperProvider: JavaHelperCapabilityProvider,
    private readonly probeProvider: ProbeCapabilityProvider,
    private readonly externalAttachProvider: ExternalAttachProvider,
  ) {}

  /** Resolve all capabilities available for the given JVM target */
  resolveCapabilities(target: JvmTargetDescriptor): CapabilityDescriptor[] {
    const capabilities: CapabilityDescriptor[] = [];

    // Local PID targets support all providers
    if (target.pid) {
      capabilities.push(...this.javaHelperProvider.describeCapabilities());
      capabilities.push(...this.probeProvider.describeCapabilities());
      capabilities.push(...this.externalAttachProvider.describeCapabilities());
    }

    // Remote / host-based targets — only probe and external-attach via SSH
    if (target.host && !target.pid) {
      capabilities.push(...this.probeProvider.describeCapabilities());
      capabilities.push(...this.externalAttachProvider.describeCapabilities());
    }

    // JMX URL targets — probe capabilities only
    if (target.jmxUrl) {
      capabilities.push(...this.probeProvider.describeCapabilities());
    }

    this.logger.debug(
      `Resolved ${capabilities.length} capabilities for target (${target.pid ?? target.host ?? target.jmxUrl})`,
    );

    return capabilities;
  }
}

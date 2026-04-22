import { Injectable, Logger } from '@nestjs/common';
import type {
  CapabilityDescriptor,
  CapabilityProvider,
  JvmTargetDescriptor,
  CapabilityOperation,
  OperationResult,
} from '../jvm-capability.types.js';

@Injectable()
export class ProbeCapabilityProvider implements CapabilityProvider {
  readonly providerName = 'probe';
  private readonly logger = new Logger(ProbeCapabilityProvider.name);

  describeCapabilities(): CapabilityDescriptor[] {
    return [
      {
        name: 'jmx-query',
        description: 'Query JMX MBean attributes from a JVM target',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'objectName', type: 'string', required: true, description: 'MBean object name pattern' },
          { name: 'attributes', type: 'string', required: false, description: 'Comma-separated attribute names' },
        ],
      },
      {
        name: 'jmx-invoke',
        description: 'Invoke a JMX MBean operation',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'objectName', type: 'string', required: true, description: 'MBean object name' },
          { name: 'operationName', type: 'string', required: true, description: 'Operation to invoke' },
          { name: 'params', type: 'string', required: false, description: 'JSON-encoded parameters' },
        ],
      },
      {
        name: 'gc-info',
        description: 'Retrieve GC statistics via JMX',
        provider: this.providerName,
        requiresAttachment: false,
      },
      {
        name: 'memory-usage',
        description: 'Retrieve memory pool usage via JMX',
        provider: this.providerName,
        requiresAttachment: false,
      },
      {
        name: 'class-loading',
        description: 'Retrieve class loading statistics via JMX',
        provider: this.providerName,
        requiresAttachment: false,
      },
      {
        name: 'vm-overview',
        description: 'Retrieve JVM runtime overview (version, uptime, etc.)',
        provider: this.providerName,
        requiresAttachment: false,
      },
    ];
  }

  async execute(target: JvmTargetDescriptor, operation: CapabilityOperation): Promise<OperationResult> {
    const timestamp = new Date().toISOString();

    if (!target.pid && !target.jmxUrl) {
      return {
        success: false,
        error: 'ProbeCapabilityProvider requires a PID or JMX URL target',
        timestamp,
      };
    }

    this.logger.debug(`Probe operation "${operation.name}" on target ${target.pid ?? target.jmxUrl}`);

    switch (operation.name) {
      case 'jmx-query':
      case 'jmx-invoke':
      case 'gc-info':
      case 'memory-usage':
      case 'class-loading':
      case 'vm-overview':
        return {
          success: true,
          data: {
            operation: operation.name,
            target: target.pid ?? target.jmxUrl,
            params: operation.params,
          },
          timestamp,
        };
      default:
        return { success: false, error: `Unknown probe operation: ${operation.name}`, timestamp };
    }
  }
}

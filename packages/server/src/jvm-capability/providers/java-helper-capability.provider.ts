import { Injectable, Logger } from '@nestjs/common';
import { JavaHelperService } from '../../java-helper/java-helper.service.js';
import type {
  CapabilityDescriptor,
  CapabilityProvider,
  JvmTargetDescriptor,
  CapabilityOperation,
  OperationResult,
} from '../jvm-capability.types.js';

@Injectable()
export class JavaHelperCapabilityProvider implements CapabilityProvider {
  readonly providerName = 'java-helper';
  private readonly logger = new Logger(JavaHelperCapabilityProvider.name);

  constructor(private readonly javaHelperService: JavaHelperService) {}

  describeCapabilities(): CapabilityDescriptor[] {
    return [
      {
        name: 'thread-dump',
        description: 'Capture a thread dump from an attached JVM',
        provider: this.providerName,
        requiresAttachment: true,
      },
      {
        name: 'heap-histogram',
        description: 'Capture a heap histogram (object count by class)',
        provider: this.providerName,
        requiresAttachment: true,
      },
      {
        name: 'thread-sample',
        description: 'Sample thread CPU usage over a short interval',
        provider: this.providerName,
        requiresAttachment: true,
      },
      {
        name: 'heap-sample',
        description: 'Sample heap memory usage and GC statistics',
        provider: this.providerName,
        requiresAttachment: true,
      },
      {
        name: 'jfr-start',
        description: 'Start a Java Flight Recorder recording',
        provider: this.providerName,
        requiresAttachment: true,
        parameters: [
          { name: 'duration', type: 'number', required: false, description: 'Recording duration in seconds' },
          { name: 'name', type: 'string', required: false, description: 'Recording name' },
        ],
      },
      {
        name: 'jfr-stop',
        description: 'Stop an active Java Flight Recorder recording',
        provider: this.providerName,
        requiresAttachment: true,
      },
      {
        name: 'system-property',
        description: 'Read a JVM system property',
        provider: this.providerName,
        requiresAttachment: true,
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Property key to read' },
        ],
      },
    ];
  }

  async execute(target: JvmTargetDescriptor, operation: CapabilityOperation): Promise<OperationResult> {
    const timestamp = new Date().toISOString();

    if (!target.pid) {
      return { success: false, error: 'JavaHelperCapabilityProvider requires a local PID target', timestamp };
    }

    try {
      if (!this.javaHelperService.isReady) {
        await this.javaHelperService.start();
      }

      await this.javaHelperService.attach(target.pid);

      let data: unknown;

      switch (operation.name) {
        case 'thread-dump':
        case 'thread-sample':
          data = await this.javaHelperService.sampleThreads();
          break;
        case 'heap-histogram':
        case 'heap-sample':
          data = await this.javaHelperService.sampleHeap();
          break;
        case 'jfr-start':
          data = await this.javaHelperService.sendCommand('jfr-start', operation.params ?? {});
          break;
        case 'jfr-stop':
          data = await this.javaHelperService.sendCommand('jfr-stop', operation.params ?? {});
          break;
        case 'system-property':
          data = await this.javaHelperService.sendCommand('system-property', operation.params ?? {});
          break;
        default:
          return { success: false, error: `Unknown java-helper operation: ${operation.name}`, timestamp };
      }

      return { success: true, data, timestamp };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, timestamp };
    }
  }
}

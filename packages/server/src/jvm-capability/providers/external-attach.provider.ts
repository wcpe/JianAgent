import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  CapabilityDescriptor,
  CapabilityProvider,
  JvmTargetDescriptor,
  CapabilityOperation,
  OperationResult,
} from '../jvm-capability.types.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class ExternalAttachProvider implements CapabilityProvider {
  readonly providerName = 'external-attach';
  private readonly logger = new Logger(ExternalAttachProvider.name);

  describeCapabilities(): CapabilityDescriptor[] {
    return [
      {
        name: 'jstack',
        description: 'Capture a thread dump using the jstack CLI tool',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'flags', type: 'string', required: false, description: 'Additional jstack flags (e.g. "-l")' },
        ],
      },
      {
        name: 'jmap-histogram',
        description: 'Capture a heap histogram using jmap',
        provider: this.providerName,
        requiresAttachment: false,
      },
      {
        name: 'jmap-dump',
        description: 'Dump the heap to a file using jmap',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'file', type: 'string', required: false, description: 'Output file path' },
          { name: 'live', type: 'boolean', required: false, description: 'Only dump live objects', defaultValue: true },
        ],
      },
      {
        name: 'jcmd',
        description: 'Execute a jcmd command against a JVM',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'command', type: 'string', required: true, description: 'jcmd command to execute' },
          { name: 'args', type: 'string', required: false, description: 'Additional arguments' },
        ],
      },
      {
        name: 'jinfo',
        description: 'Retrieve JVM configuration info using jinfo',
        provider: this.providerName,
        requiresAttachment: false,
      },
      {
        name: 'jstat-gc',
        description: 'Retrieve GC statistics using jstat',
        provider: this.providerName,
        requiresAttachment: false,
        parameters: [
          { name: 'interval', type: 'number', required: false, description: 'Sample interval in ms', defaultValue: 1000 },
          { name: 'count', type: 'number', required: false, description: 'Number of samples', defaultValue: 1 },
        ],
      },
    ];
  }

  async execute(target: JvmTargetDescriptor, operation: CapabilityOperation): Promise<OperationResult> {
    const timestamp = new Date().toISOString();

    if (!target.pid) {
      return {
        success: false,
        error: 'ExternalAttachProvider requires a local PID target',
        timestamp,
      };
    }

    const pid = target.pid;
    this.logger.debug(`External attach operation "${operation.name}" on PID ${pid}`);

    try {
      let data: unknown;

      switch (operation.name) {
        case 'jstack': {
          const flags = (operation.params?.flags as string) ?? '';
          const args = flags ? [flags, pid] : [pid];
          const { stdout } = await execFileAsync('jstack', args);
          data = stdout;
          break;
        }
        case 'jmap-histogram': {
          const { stdout } = await execFileAsync('jmap', ['-histo', pid]);
          data = stdout;
          break;
        }
        case 'jmap-dump': {
          const file = (operation.params?.file as string) ?? `/tmp/heap-dump-${pid}-${Date.now()}.hprof`;
          const live = operation.params?.live !== false ? '-live' : '';
          const args = live ? [live, '-format=b', `file=${file}`, pid] : ['-format=b', `file=${file}`, pid];
          await execFileAsync('jmap', args);
          data = { file };
          break;
        }
        case 'jcmd': {
          const command = operation.params?.command as string;
          const extraArgs = (operation.params?.args as string) ?? '';
          const args = extraArgs ? [pid, command, extraArgs] : [pid, command];
          const { stdout } = await execFileAsync('jcmd', args);
          data = stdout;
          break;
        }
        case 'jinfo': {
          const { stdout } = await execFileAsync('jinfo', [pid]);
          data = stdout;
          break;
        }
        case 'jstat-gc': {
          const interval = (operation.params?.interval as number) ?? 1000;
          const count = (operation.params?.count as number) ?? 1;
          const { stdout } = await execFileAsync('jstat', ['-gc', pid, String(interval), String(count)]);
          data = stdout;
          break;
        }
        default:
          return { success: false, error: `Unknown external-attach operation: ${operation.name}`, timestamp };
      }

      return { success: true, data, timestamp };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, timestamp };
    }
  }
}

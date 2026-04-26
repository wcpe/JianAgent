import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JvmTargetResolver } from '../jvm-capability/jvm-target.resolver.js';
import type { PortUsageDto } from './dto/port-usage.dto.js';

const execAsync = promisify(exec);

interface RawPortInfo {
  port: number;
  protocol: string;
  pid: number;
  processName?: string;
  status?: string;
}

@Injectable()
export class PortService {
  private readonly logger = new Logger(PortService.name);

  constructor(private readonly jvmTargetResolver: JvmTargetResolver) {}

  async getPortUsage(): Promise<PortUsageDto[]> {
    const platform = process.platform;

    try {
      let rawPorts: RawPortInfo[];

      if (platform === 'win32') {
        rawPorts = await this.getPortsWindows();
      } else if (platform === 'darwin') {
        rawPorts = await this.getPortsMacOS();
      } else {
        rawPorts = await this.getPortsLinux();
      }

      // Enrich with JVM information
      const enriched = await Promise.all(
        rawPorts.map(async (raw) => {
          const commandLine = await this.getProcessCommandLine(raw.pid);
          const isJvm = this.isJvmProcess(commandLine);
          const jvmMainClass = isJvm ? this.extractMainClass(commandLine) : undefined;

          return {
            port: raw.port,
            protocol: raw.protocol,
            pid: raw.pid,
            processName: raw.processName,
            commandLine,
            isJvm,
            jvmMainClass,
            status: raw.status,
          };
        }),
      );

      return enriched;
    } catch (error) {
      this.logger.error(`Failed to get port usage: ${error}`);
      throw error;
    }
  }

  private async getPortsWindows(): Promise<RawPortInfo[]> {
    const { stdout } = await execAsync('netstat -ano');
    const lines = stdout.split('\n');
    const ports: RawPortInfo[] = [];

    for (const line of lines) {
      const match = line.match(/^\s*(TCP|UDP)\s+[\d.]+:(\d+)\s+.*\s+(\d+)\s*$/);
      if (match) {
        const [, protocol, port, pid] = match;
        ports.push({
          port: parseInt(port, 10),
          protocol: protocol.toLowerCase(),
          pid: parseInt(pid, 10),
        });
      }
    }

    return ports;
  }

  private async getPortsMacOS(): Promise<RawPortInfo[]> {
    const { stdout } = await execAsync('lsof -iTCP -n -P');
    const lines = stdout.split('\n').slice(1); // Skip header
    const ports: RawPortInfo[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const processName = parts[0];
      const pid = parseInt(parts[1], 10);
      const status = parts[7];
      const address = parts[8];
      const portMatch = address.match(/:(\d+)$/);

      if (portMatch) {
        ports.push({
          port: parseInt(portMatch[1], 10),
          protocol: 'tcp',
          pid,
          processName,
          status,
        });
      }
    }

    return ports;
  }

  private async getPortsLinux(): Promise<RawPortInfo[]> {
    const { stdout } = await execAsync('ss -tupn');
    const lines = stdout.split('\n').slice(1); // Skip header
    const ports: RawPortInfo[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;

      const protocol = parts[0].toLowerCase();
      const address = parts[4];
      const portMatch = address.match(/:(\d+)$/);
      const processMatch = parts[6]?.match(/pid=(\d+)/);

      if (portMatch && processMatch) {
        ports.push({
          port: parseInt(portMatch[1], 10),
          protocol,
          pid: parseInt(processMatch[1], 10),
        });
      }
    }

    return ports;
  }

  private async getProcessCommandLine(pid: number): Promise<string | undefined> {
    try {
      const platform = process.platform;

      if (platform === 'win32') {
        const { stdout } = await execAsync(
          `wmic process where ProcessId=${pid} get CommandLine /format:list`,
        );
        const match = stdout.match(/CommandLine=(.*)/);
        return match?.[1]?.trim();
      } else {
        const { stdout } = await execAsync(`ps -p ${pid} -o command=`);
        return stdout.trim();
      }
    } catch (error) {
      this.logger.debug(`Failed to get command line for PID ${pid}: ${error}`);
      return undefined;
    }
  }

  private isJvmProcess(commandLine?: string): boolean {
    if (!commandLine) return false;
    return commandLine.includes('java') || commandLine.includes('jre') || commandLine.includes('jdk');
  }

  private extractMainClass(commandLine?: string): string | undefined {
    if (!commandLine) return undefined;

    // Try to extract main class from command line
    // Pattern: java ... -jar xxx.jar or java ... com.example.MainClass
    const jarMatch = commandLine.match(/-jar\s+([^\s]+)/);
    if (jarMatch) {
      return jarMatch[1];
    }

    // Try to find main class (usually after all JVM options)
    const parts = commandLine.split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'java' || parts[i].endsWith('/java') || parts[i].endsWith('\\java.exe')) {
        // Skip JVM options (starting with -)
        for (let j = i + 1; j < parts.length; j++) {
          if (!parts[j].startsWith('-') && parts[j].includes('.')) {
            return parts[j];
          }
        }
      }
    }

    return undefined;
  }
}

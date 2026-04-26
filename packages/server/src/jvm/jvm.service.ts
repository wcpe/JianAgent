import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { JavaHelperService } from '../java-helper/java-helper.service';
import { execSync } from 'child_process';
import type { JvmProcessDto } from './dto/jvm-process.dto';

@Injectable()
export class JvmService implements OnModuleInit {
  private readonly logger = new Logger(JvmService.name);

  constructor(private readonly javaHelper: JavaHelperService) {}

  async onModuleInit() {
    try {
      await this.javaHelper.start();
      this.logger.log('Java helper service started');
    } catch (err) {
      this.logger.error('Failed to start Java helper service', err);
    }
  }

  async listJavaProcesses(): Promise<JvmProcessDto[]> {
    try {
      const isWin = process.platform === 'win32';
      const cmd = isWin
        ? 'wmic process where "name like \'%java%\'" get processid,commandline /format:csv'
        : "ps -eo pid,command | grep java | grep -v grep";

      const output = execSync(cmd, { timeout: 5000, encoding: 'utf8' });
      const processes: JvmProcessDto[] = [];

      if (isWin) {
        for (const line of output.split('\n')) {
          const parts = line.trim().split(',');
          if (parts.length >= 3) {
            const pid = parseInt(parts[parts.length - 1]!, 10);
            const command = parts.slice(1, -1).join(',');
            if (!isNaN(pid) && pid > 0) {
              processes.push({ pid, command, name: this.extractProcessName(command) });
            }
          }
        }
      } else {
        for (const line of output.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const match = trimmed.match(/^\s*(\d+)\s+(.+)$/);
          if (match) {
            const pid = parseInt(match[1]!, 10);
            const command = match[2]!.trim();
            if (!isNaN(pid) && pid > 0) {
              processes.push({ pid, command, name: this.extractProcessName(command) });
            }
          }
        }
      }

      return processes;
    } catch (err) {
      this.logger.error('Failed to list Java processes', err);
      throw new Error('Failed to list Java processes');
    }
  }

  async attachToProcess(pid: string) {
    const pidNum = parseInt(pid, 10);
    if (isNaN(pidNum) || pidNum <= 0) {
      throw new BadRequestException('Invalid PID: must be a positive integer');
    }
    return await this.javaHelper.attach(pid);
  }

  async detachFromProcess() {
    return await this.javaHelper.detach();
  }

  async sampleThreads() {
    return await this.javaHelper.sampleThreads();
  }

  async sampleHeap() {
    return await this.javaHelper.sampleHeap();
  }

  async getStatus() {
    return await this.javaHelper.getStatus();
  }

  private extractProcessName(command: string): string {
    const jarMatch = command.match(/([^/\\]+\.jar)/i);
    if (jarMatch) return jarMatch[1]!;

    const classMatch = command.match(/\s+([a-zA-Z0-9_$.]+\.Main|[a-zA-Z0-9_$.]+Application)/);
    if (classMatch) return classMatch[1]!;

    return 'Java Process';
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JavaHelperService } from '../java-helper/java-helper.service.js';
import type { MonitoringSnapshotDto } from './dto/monitoring-snapshot.dto.js';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { resolve } from 'path';

interface MonitoringSession {
  pid: string;
  interval: number;
  process: ChildProcess;
  callback: (data: MonitoringSnapshotDto) => void;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly sessions = new Map<string, MonitoringSession>();

  constructor(private readonly javaHelper: JavaHelperService) {}

  async startMonitoring(
    pid: string,
    interval: number,
    callback: (data: MonitoringSnapshotDto) => void,
  ): Promise<void> {
    // Stop existing session if any
    if (this.sessions.has(pid)) {
      this.logger.log(`Stopping existing monitoring session for PID ${pid}`);
      await this.stopMonitoring(pid);
    }

    this.logger.log(`Starting monitoring for PID ${pid} with interval ${interval}s`);

    try {
      // Resolve jar path
      const jarPath = await this.resolveJarPath();

      // Spawn java-helper process with monitoring command
      const helperProcess = spawn('java', [
        '--add-exports', 'jdk.attach/sun.tools.attach=ALL-UNNAMED',
        '-jar',
        jarPath,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Send start-monitoring command
      const startCommand = JSON.stringify({
        type: 'start-monitoring',
        pid,
        interval,
      });
      helperProcess.stdin?.write(startCommand + '\n');

      // Setup readline to parse JSON output
      const rl = createInterface({ input: helperProcess.stdout! });
      
      rl.on('line', (line) => {
        try {
          const data = JSON.parse(line);
          
          // Handle different message types
          if (data.type === 'ready') {
            this.logger.log(`Java helper ready for PID ${pid}`);
            return;
          }
          
          if (data.type === 'monitoring-snapshot') {
            // Forward snapshot to callback
            callback(data as MonitoringSnapshotDto);
          } else if (data.type === 'error') {
            this.logger.error(`Monitoring error for PID ${pid}: ${data.message}`);
          }
        } catch (err) {
          this.logger.warn(`Failed to parse monitoring output: ${line}`, err);
        }
      });

      helperProcess.stderr?.on('data', (data: Buffer) => {
        this.logger.warn(`Java helper stderr (PID ${pid}): ${data.toString()}`);
      });

      helperProcess.on('exit', (code) => {
        this.logger.log(`Monitoring process for PID ${pid} exited with code ${code}`);
        this.sessions.delete(pid);
      });

      // Store session
      this.sessions.set(pid, {
        pid,
        interval,
        process: helperProcess,
        callback,
      });

      this.logger.log(`Monitoring started for PID ${pid}`);
    } catch (err) {
      this.logger.error(`Failed to start monitoring for PID ${pid}`, err);
      throw err;
    }
  }

  async stopMonitoring(pid: string): Promise<void> {
    const session = this.sessions.get(pid);
    if (!session) {
      this.logger.warn(`No monitoring session found for PID ${pid}`);
      return;
    }

    this.logger.log(`Stopping monitoring for PID ${pid}`);

    try {
      // Send stop-monitoring command
      const stopCommand = JSON.stringify({
        type: 'stop-monitoring',
      });
      session.process.stdin?.write(stopCommand + '\n');

      // Give it a moment to stop gracefully
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Kill the process if still running
      if (!session.process.killed) {
        session.process.kill('SIGTERM');
      }

      this.sessions.delete(pid);
      this.logger.log(`Monitoring stopped for PID ${pid}`);
    } catch (err) {
      this.logger.error(`Failed to stop monitoring for PID ${pid}`, err);
      throw err;
    }
  }

  isMonitoring(pid: string): boolean {
    return this.sessions.has(pid);
  }

  getActiveMonitoringSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async stopAllMonitoring(): Promise<void> {
    const pids = Array.from(this.sessions.keys());
    await Promise.all(pids.map((pid) => this.stopMonitoring(pid)));
  }

  private async resolveJarPath(): Promise<string> {
    // Try multiple possible locations
    const possiblePaths = [
      resolve(process.cwd(), 'plugin/java-helper/build/libs/java-helper.jar'),
      resolve(process.cwd(), '../plugin/java-helper/build/libs/java-helper.jar'),
      resolve(process.cwd(), '../../plugin/java-helper/build/libs/java-helper.jar'),
    ];

    const fs = await import('fs/promises');
    for (const path of possiblePaths) {
      try {
        await fs.access(path);
        this.logger.log(`Found java-helper.jar at ${path}`);
        return path;
      } catch {
        // Continue to next path
      }
    }

    throw new Error('java-helper.jar not found. Please build the plugin first.');
  }
}

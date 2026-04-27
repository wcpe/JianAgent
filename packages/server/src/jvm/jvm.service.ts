import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { JavaHelperService } from '../java-helper/java-helper.service';
import { DiagnosticFileService } from '../file-manager/diagnostic-file.service';
import { execSync } from 'child_process';
import type { JvmProcessDto } from './dto/jvm-process.dto';
import * as fs from 'fs/promises';
import { basename } from 'path';

@Injectable()
export class JvmService implements OnModuleInit {
  private readonly logger = new Logger(JvmService.name);

  constructor(
    private readonly javaHelper: JavaHelperService,
    private readonly diagnosticFileService: DiagnosticFileService,
  ) {}

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
              processes.push({
                pid,
                command,
                name: this.extractProcessName(command),
                mainClass: this.extractMainClass(command),
              });
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
              const meta = this.getUnixProcessMeta(pid);
              processes.push({
                pid,
                command,
                name: this.extractProcessName(command),
                mainClass: this.extractMainClass(command),
                user: meta?.user,
                startTime: meta?.startTime,
                uptimeSec: meta?.uptimeSec,
              });
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
    if (this.javaHelper.helperPid && pidNum === this.javaHelper.helperPid) {
      throw new BadRequestException('Cannot attach probe to Java helper process itself');
    }

    // Attach to the process
    const attachResult = await this.javaHelper.attach(pid);

    // Immediately sample heap and threads to get initial data
    try {
      const [heapData, threadData] = await Promise.all([
        this.javaHelper.sampleHeap(),
        this.javaHelper.sampleThreads(),
      ]);

      // Return combined data
      return {
        ...(attachResult as object),
        heap: heapData,
        threads: threadData,
      };
    } catch (err) {
      this.logger.warn('Failed to sample metrics after attachment', err);
      return attachResult;
    }
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

  async generateHeapDump(outputPath: string, liveObjectsOnly = true) {
    const result = await this.javaHelper.generateHeapDump(outputPath, liveObjectsOnly);
    
    // 注册文件到文件中心
    try {
      const stats = await fs.stat(outputPath);
      const status = await this.javaHelper.getStatus();
      const pid = status.attachedPid ? parseInt(status.attachedPid, 10) : 0;
      const processName = await this.getProcessName(pid);
      
      await this.diagnosticFileService.registerFile({
        pid,
        processName,
        fileType: 'heap-dump',
        filePath: outputPath,
        fileSize: stats.size,
        description: `Heap dump (live objects only: ${liveObjectsOnly})`,
      });
      
      this.logger.log(`Registered heap dump file: ${outputPath}`);
    } catch (error) {
      this.logger.warn(`Failed to register heap dump file: ${error}`);
    }
    
    return result;
  }

  async generateThreadDump(outputPath: string, includeLockedMonitors = true, includeLockedSynchronizers = true) {
    const result = await this.javaHelper.generateThreadDump(outputPath, includeLockedMonitors, includeLockedSynchronizers);
    
    // 注册文件到文件中心
    try {
      const stats = await fs.stat(outputPath);
      const status = await this.javaHelper.getStatus();
      const pid = status.attachedPid ? parseInt(status.attachedPid, 10) : 0;
      const processName = await this.getProcessName(pid);
      
      await this.diagnosticFileService.registerFile({
        pid,
        processName,
        fileType: 'thread-dump',
        filePath: outputPath,
        fileSize: stats.size,
        description: `Thread dump (monitors: ${includeLockedMonitors}, synchronizers: ${includeLockedSynchronizers})`,
      });
      
      this.logger.log(`Registered thread dump file: ${outputPath}`);
    } catch (error) {
      this.logger.warn(`Failed to register thread dump file: ${error}`);
    }
    
    return result;
  }

  async checkDiskSpace(path: string) {
    return await this.javaHelper.checkDiskSpace(path);
  }

  async estimateHeapSize() {
    return await this.javaHelper.estimateHeapSize();
  }

  async startJfrRecording(options: { name?: string; durationSeconds?: number; maxSize?: number; maxAge?: number }) {
    return await this.javaHelper.startJfrRecording(options);
  }

  async stopJfrRecording(recordingId: number, outputPath: string) {
    const result = await this.javaHelper.stopJfrRecording(recordingId, outputPath);
    
    // 注册文件到文件中心
    try {
      const stats = await fs.stat(outputPath);
      const status = await this.javaHelper.getStatus();
      const pid = status.attachedPid ? parseInt(status.attachedPid, 10) : 0;
      const processName = await this.getProcessName(pid);
      
      await this.diagnosticFileService.registerFile({
        pid,
        processName,
        fileType: 'jfr',
        filePath: outputPath,
        fileSize: stats.size,
        description: `JFR recording (ID: ${recordingId})`,
      });
      
      this.logger.log(`Registered JFR file: ${outputPath}`);
    } catch (error) {
      this.logger.warn(`Failed to register JFR file: ${error}`);
    }
    
    return result;
  }

  async getJfrStatus(recordingId: number) {
    return await this.javaHelper.getJfrStatus(recordingId);
  }

  async getJvmFlags() {
    return await this.javaHelper.getJvmFlags();
  }

  async getClassLoadingInfo() {
    return await this.javaHelper.getClassLoadingInfo();
  }

  async getGcInfo() {
    return await this.javaHelper.getGcInfo();
  }

  async startCpuSampling(options: { durationSeconds?: number; intervalMs?: number }) {
    const result = await this.javaHelper.startCpuSampling(options);
    
    // CPU 采样完成后注册文件（如果返回结果中包含文件路径）
    try {
      if (result && typeof result === 'object' && 'outputPath' in result) {
        const outputPath = (result as any).outputPath as string;
        const stats = await fs.stat(outputPath);
        const status = await this.javaHelper.getStatus();
        const pid = status.attachedPid ? parseInt(status.attachedPid, 10) : 0;
        const processName = await this.getProcessName(pid);
        
        await this.diagnosticFileService.registerFile({
          pid,
          processName,
          fileType: 'cpu-sample',
          filePath: outputPath,
          fileSize: stats.size,
          description: `CPU sampling (duration: ${options.durationSeconds || 'default'}s, interval: ${options.intervalMs || 'default'}ms)`,
        });
        
        this.logger.log(`Registered CPU sampling file: ${outputPath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to register CPU sampling file: ${error}`);
    }
    
    return result;
  }

  async shutdownJvm(pid: string, graceful: boolean, timeoutSeconds?: number) {
    const pidNum = parseInt(pid, 10);
    if (isNaN(pidNum) || pidNum <= 0) {
      throw new BadRequestException('Invalid PID: must be a positive integer');
    }

    // 检查是否已经 attach 到目标进程
    const status = await this.javaHelper.getStatus();
    const currentPid = status.attachedPid;

    try {
      // 如果未 attach 或 attach 到其他进程，先 attach 到目标进程
      if (currentPid !== pid) {
        this.logger.log(`Attaching to process ${pid} for shutdown`);
        await this.javaHelper.attach(pid);
      }

      // 执行关闭操作
      this.logger.log(`Shutting down process ${pid} (graceful: ${graceful}, timeout: ${timeoutSeconds || 30}s)`);
      const result = await this.javaHelper.shutdown(graceful, timeoutSeconds);

      return result;
    } catch (err) {
      this.logger.error(`Failed to shutdown process ${pid}`, err);
      
      // 根据错误类型提供更友好的错误信息
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('Connection refused') || errorMessage.includes('not found')) {
        throw new BadRequestException(`Process ${pid} not found or JMX connection failed`);
      } else if (errorMessage.includes('Timeout')) {
        throw new BadRequestException(`Shutdown operation timed out for process ${pid}`);
      } else if (errorMessage.includes('Permission denied')) {
        throw new BadRequestException(`Permission denied: cannot shutdown process ${pid}`);
      }
      
      throw err;
    }
  }

  private extractProcessName(command: string): string {
    const jarMatch = command.match(/([^/\\]+\.jar)/i);
    if (jarMatch) return jarMatch[1]!;

    const classMatch = command.match(/\s+([a-zA-Z0-9_$.]+\.Main|[a-zA-Z0-9_$.]+Application)/);
    if (classMatch) return classMatch[1]!;

    return 'Java Process';
  }

  private extractMainClass(command: string): string | undefined {
    const jarMatch = command.match(/-jar\s+([^\s]+)/);
    if (jarMatch) {
      return jarMatch[1]?.trim();
    }

    const segments = command.split(/\s+/).filter(Boolean);
    for (let i = 0; i < segments.length; i++) {
      if (segments[i] === 'java' || segments[i]?.endsWith('/java') || segments[i]?.endsWith('\\java.exe')) {
        for (let j = i + 1; j < segments.length; j++) {
          const current = segments[j];
          if (!current || current.startsWith('-')) continue;
          if (current.includes('.')) return current;
        }
      }
    }

    return undefined;
  }

  private getUnixProcessMeta(pid: number): { user?: string; startTime?: string; uptimeSec?: number } | null {
    try {
      const output = execSync(`ps -p ${pid} -o user= -o lstart= -o etime=`, {
        timeout: 3000,
        encoding: 'utf8',
      }).trim();

      const match = output.match(/^(.+?)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+([\d:-]+)$/);
      if (!match) {
        return null;
      }

      return {
        user: match[1]?.trim(),
        startTime: match[2]?.trim(),
        uptimeSec: this.parseElapsedToSeconds(match[3]?.trim() ?? ''),
      };
    } catch {
      return null;
    }
  }

  private parseElapsedToSeconds(elapsed: string): number | undefined {
    if (!elapsed) return undefined;
    const daySplit = elapsed.split('-');
    const timePart = daySplit.length === 2 ? daySplit[1] : daySplit[0];
    const days = daySplit.length === 2 ? Number.parseInt(daySplit[0] ?? '0', 10) : 0;
    const parts = timePart.split(':').map((v) => Number.parseInt(v, 10));
    if (parts.some((v) => Number.isNaN(v))) return undefined;

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
      [hours, minutes, seconds] = parts;
    } else if (parts.length === 2) {
      [minutes, seconds] = parts;
    } else if (parts.length === 1) {
      [seconds] = parts;
    }

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  private async getProcessName(pid: number): Promise<string> {
    if (!pid || pid <= 0) {
      return 'Unknown';
    }

    try {
      const processes = await this.listJavaProcesses();
      const process = processes.find(p => p.pid === pid);
      return process?.name || `Process ${pid}`;
    } catch (error) {
      this.logger.warn(`Failed to get process name for PID ${pid}:`, error);
      return `Process ${pid}`;
    }
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import type { AttachServerDto, AttachResult, ArthasStatus } from './dto/attach-server.dto.js';
import type { ExecuteCommandDto, CommandResult } from './dto/execute-command.dto.js';

// Arthas 事件名称常量
export const ARTHAS_EVENTS = {
  DETACHED: 'arthas.detached',
  ERROR: 'arthas.error',
} as const;

const ARTHAS_VERSION = '3.7.2';
const ARTHAS_BOOT_URL = `https://arthas.aliyun.com/arthas-boot.jar`;
const ARTHAS_DIR = path.join(process.cwd(), 'data', 'arthas');
const ARTHAS_BOOT_JAR = path.join(ARTHAS_DIR, 'arthas-boot.jar');
const DEFAULT_HTTP_PORT = 8563;
const DEFAULT_TELNET_PORT = 3658;
const ATTACH_TIMEOUT = 30000;
const COMMAND_TIMEOUT = 30000;

interface ArthasInstance {
  serverId: string;
  pid: number;
  process: ChildProcess | null;
  httpPort: number;
  telnetPort: number;
  startTime: number;
  attached: boolean;
}

@Injectable()
export class ArthasService implements OnModuleDestroy {
  private readonly logger = new Logger(ArthasService.name);
  private readonly instances = new Map<string, ArthasInstance>();
  private bootJarReady = false;

  constructor(private readonly eventBus: EventEmitter2) {
    void this.ensureArthasBootJar();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down all Arthas instances...');
    const detachPromises = Array.from(this.instances.keys()).map((serverId) =>
      this.detach(serverId).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to detach ${serverId}: ${errorMessage}`);
      }),
    );
    await Promise.all(detachPromises);
  }

  /**
   * Download arthas-boot.jar if not exists
   */
  private async ensureArthasBootJar(): Promise<void> {
    try {
      await fs.mkdir(ARTHAS_DIR, { recursive: true });
      
      try {
        await fs.access(ARTHAS_BOOT_JAR);
        this.logger.log(`Arthas boot jar already exists at ${ARTHAS_BOOT_JAR}`);
        this.bootJarReady = true;
        return;
      } catch {
        // File doesn't exist, download it
      }

      this.logger.log(`Downloading Arthas boot jar from ${ARTHAS_BOOT_URL}...`);
      await this.downloadFile(ARTHAS_BOOT_URL, ARTHAS_BOOT_JAR);
      this.logger.log(`Arthas boot jar downloaded successfully`);
      this.bootJarReady = true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to ensure Arthas boot jar: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(dest);
      const isHttps = url.startsWith('https');

      const handleResponse = (response: http.IncomingMessage) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          file.close();
          require('fs').unlinkSync(dest);
          this.downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          require('fs').unlinkSync(dest);
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      };

      const handleError = (err: Error) => {
        file.close();
        try {
          require('fs').unlinkSync(dest);
        } catch {
          // Ignore if file doesn't exist
        }
        reject(err);
      };

      const request = isHttps 
        ? https.get(url, handleResponse)
        : http.get(url, handleResponse);

      request.on('error', handleError);

      file.on('error', handleError);
    });
  }

  /**
   * Attach Arthas to a Java process
   */
  async attach(serverId: string, dto: AttachServerDto): Promise<AttachResult> {
    try {
      if (!this.bootJarReady) {
        await this.ensureArthasBootJar();
      }

      if (this.instances.has(serverId)) {
        const existing = this.instances.get(serverId)!;
        if (existing.attached) {
          return {
            success: false,
            serverId,
            httpPort: existing.httpPort,
            telnetPort: existing.telnetPort,
            error: 'Arthas already attached to this server',
          };
        }
      }

      const httpPort = dto.httpPort ?? DEFAULT_HTTP_PORT;
      const telnetPort = dto.telnetPort ?? DEFAULT_TELNET_PORT;

      this.logger.log(`Attaching Arthas to PID ${dto.pid} on server ${serverId}...`);

      const args = [
        '-jar',
        ARTHAS_BOOT_JAR,
        dto.pid.toString(),
        '--telnet-port',
        telnetPort.toString(),
        '--http-port',
        httpPort.toString(),
        '--session-timeout',
        '3600',
      ];

      if (dto.tunnelServer) {
        args.push('--tunnel-server', dto.tunnelServer);
      }

      const arthasProcess = spawn('java', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      const instance: ArthasInstance = {
        serverId,
        pid: dto.pid,
        process: arthasProcess,
        httpPort,
        telnetPort,
        startTime: Date.now(),
        attached: false,
      };

      this.instances.set(serverId, instance);

      let outputBuffer = '';

      arthasProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        this.logger.debug(`[Arthas ${serverId}] ${output.trim()}`);
      });

      arthasProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        this.logger.warn(`[Arthas ${serverId} stderr] ${output.trim()}`);
      });

      arthasProcess.on('exit', (code, signal) => {
        this.logger.log(`Arthas process for ${serverId} exited with code ${code}, signal ${signal}`);
        const inst = this.instances.get(serverId);
        if (inst) {
          inst.attached = false;
          inst.process = null;
        }
        // 通过事件总线广播断开事件，供 Gateway 或其他监听者使用
        try {
          this.eventBus.emit(ARTHAS_EVENTS.DETACHED, {
            serverId,
            reason: `Arthas 进程异常退出 (code=${code})`,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          this.logger.error(`Failed to emit detach event: ${err}`);
        }
      });

      arthasProcess.on('error', (error) => {
        this.logger.error(`Arthas process error for ${serverId}: ${error.message}`);
        this.instances.delete(serverId);
      });

      // Wait for Arthas to be ready
      const ready = await this.waitForArthasReady(httpPort, ATTACH_TIMEOUT);

      if (!ready) {
        arthasProcess.kill();
        this.instances.delete(serverId);
        return {
          success: false,
          serverId,
          httpPort,
          telnetPort,
          error: 'Arthas failed to start within timeout',
        };
      }

      instance.attached = true;
      this.logger.log(`Arthas successfully attached to ${serverId} (PID: ${dto.pid})`);

      return {
        success: true,
        serverId,
        httpPort,
        telnetPort,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to attach Arthas to ${serverId}: ${errorMessage}`, errorStack);
      this.instances.delete(serverId);
      return {
        success: false,
        serverId,
        httpPort: dto.httpPort ?? DEFAULT_HTTP_PORT,
        telnetPort: dto.telnetPort ?? DEFAULT_TELNET_PORT,
        error: errorMessage,
      };
    }
  }

  /**
   * Wait for Arthas HTTP API to be ready
   */
  private async waitForArthasReady(port: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        // Check if Arthas web UI is accessible (returns HTML)
        const result = await this.httpRequest(`http://127.0.0.1:${port}/`, 'GET', null, 2000);
        if (result) {
          return true;
        }
      } catch {
        // Ignore errors, keep trying
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Detach Arthas from a server
   */
  async detach(serverId: string): Promise<void> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      throw new Error(`No Arthas instance found for server ${serverId}`);
    }

    this.logger.log(`Detaching Arthas from ${serverId}...`);

    try {
      // Try graceful shutdown via API
      if (instance.attached) {
        await this.httpRequest(
          `http://127.0.0.1:${instance.httpPort}/api/shutdown`,
          'POST',
          null,
          5000,
        ).catch(() => {
          // Ignore errors
        });
      }
    } catch {
      // Ignore errors
    }

    // Force kill if still running
    if (instance.process && !instance.process.killed) {
      instance.process.kill('SIGTERM');
      
      // Wait a bit, then force kill
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (instance.process && !instance.process.killed) {
        instance.process.kill('SIGKILL');
      }
    }

    this.instances.delete(serverId);
    this.logger.log(`Arthas detached from ${serverId}`);
  }

  /**
   * Execute Arthas command
   */
  async executeCommand(dto: ExecuteCommandDto): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const instance = this.instances.get(dto.serverId);
      if (!instance || !instance.attached) {
        return {
          success: false,
          error: `Arthas not attached to server ${dto.serverId}`,
          executionTime: Date.now() - startTime,
        };
      }

      const timeout = dto.timeout ?? COMMAND_TIMEOUT;
      const url = `http://127.0.0.1:${instance.httpPort}/api`;

      this.logger.debug(`Executing command on ${dto.serverId}: ${dto.command}`);

      const payload = {
        action: 'exec',
        command: dto.command,
      };

      const response = await this.httpRequest(url, 'POST', payload, timeout);

      if (!response) {
        return {
          success: false,
          error: 'Empty response from Arthas',
          executionTime: Date.now() - startTime,
        };
      }

      const result = JSON.parse(response);

      return {
        success: result.state === 0 || result.state === 'SUCCEEDED',
        output: result.body || JSON.stringify(result, null, 2),
        error: result.state !== 0 && result.state !== 'SUCCEEDED' ? result.message : undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute command: ${errorMessage}`, errorStack);
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get Arthas status for a server (with active health check)
   */
  async getStatus(serverId: string): Promise<ArthasStatus> {
    const instance = this.instances.get(serverId);

    if (!instance) {
      return {
        attached: false,
        serverId,
      };
    }

    // 如果状态为 attached，执行主动健康检查
    if (instance.attached) {
      const healthy = await this.healthCheck(instance);
      if (!healthy) {
        this.logger.warn(`Health check failed for Arthas instance ${serverId}, marking as detached`);
        instance.attached = false;
        instance.process = null;
        this.instances.delete(serverId);
        // 通过事件总线广播断开事件
        try {
          this.eventBus.emit(ARTHAS_EVENTS.DETACHED, {
            serverId,
            reason: 'Arthas 健康检查失败',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          this.logger.error(`Failed to emit detach event: ${err}`);
        }
        return {
          attached: false,
          serverId,
          healthCheckFailed: true,
        };
      }
    }

    return {
      attached: instance.attached,
      serverId,
      pid: instance.pid,
      httpPort: instance.httpPort,
      telnetPort: instance.telnetPort,
      uptime: instance.attached ? Date.now() - instance.startTime : undefined,
    };
  }

  /**
   * Perform a lightweight health check on an Arthas instance
   */
  private async healthCheck(instance: ArthasInstance): Promise<boolean> {
    try {
      // 检查进程是否还在运行
      if (!instance.process && instance.attached) {
        // 尝试通过 HTTP API 验证
        const result = await this.httpRequest(
          `http://127.0.0.1:${instance.httpPort}/api`,
          'POST',
          { action: 'exec', command: 'version' },
          5000,
        );
        if (result) {
          // API 还活着，但进程引用丢了，重建引用
          return true;
        }
        return false;
      }

      // 进程存在但状态异常
      if (instance.process && !instance.process.killed) {
        try {
          const exitCode = instance.process.exitCode;
          if (exitCode !== null) {
            return false;
          }
        } catch {
          // process.exitCode may throw on some platforms
        }
      }

      // 尝试快速 API 调用验证
      const result = await this.httpRequest(
        `http://127.0.0.1:${instance.httpPort}/api`,
        'POST',
        { action: 'exec', command: 'version' },
        3000,
      );
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request to Arthas API
   */
  private async httpRequest(
    url: string,
    method: 'GET' | 'POST',
    body: any,
    timeout: number,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}

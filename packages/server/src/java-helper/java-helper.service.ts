import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, execFile, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createInterface } from 'readline';
import { join, resolve } from 'path';
import { mkdtemp, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { createFallbackEntryClasses, parseManifestText } from './jar-scan.util.js';

type JavaHelperState = 'IDLE' | 'RESOLVING' | 'ATTACHING' | 'ATTACHED' | 'SAMPLING' | 'DETACHING' | 'FAILED';

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (err: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class JavaHelperService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(JavaHelperService.name);
  private process: ChildProcess | null = null;
  private state: JavaHelperState = 'IDLE';
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private ready = false;

  get currentState(): JavaHelperState {
    return this.state;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get helperPid(): number | undefined {
    return this.process?.pid;
  }

  async start(): Promise<void> {
    if (this.process) return;

    let jarPath: string;
    try {
      jarPath = await this.resolveJarPath();
    } catch (err) {
      this.logger.warn('Java helper jar not found, service will not be available');
      this.state = 'FAILED';
      return;
    }

    this.process = spawn('java', [
      '--add-exports', 'jdk.attach/sun.tools.attach=ALL-UNNAMED',
      '-jar',
      jarPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'ready') {
          this.ready = true;
          this.logger.log('Java helper ready');
          return;
        }
        this.handleResponse(msg);
      } catch (err) {
        this.logger.warn(`Unparseable output: ${line}`, err);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.logger.warn(`Java helper stderr: ${data.toString()}`);
    });

    this.process.on('exit', (code) => {
      this.logger.warn(`Java helper exited with code ${code}`);
      this.ready = false;
      this.process = null;
      this.rejectAllPending('Process exited');
      this.setState('IDLE');
    });
  }

  async sendCommand(type: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.process?.stdin?.writable) {
      throw new Error('Java helper process not running');
    }

    const requestId = `req_${++this.requestCounter}`;
    const payload = JSON.stringify({ type, requestId, ...params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timeout waiting for ${type}`));
      }, 30_000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.process!.stdin!.write(payload + '\n');
    });
  }

  async resolve(): Promise<unknown> {
    this.setState('RESOLVING');
    try {
      const result = await this.sendCommand('resolve');
      this.setState('IDLE');
      return result;
    } catch (e) {
      this.setState('FAILED');
      throw e;
    }
  }

  async attach(pid: string): Promise<unknown> {
    this.setState('ATTACHING');
    try {
      const result = await this.sendCommand('attach', { pid });
      this.setState('ATTACHED');
      return result;
    } catch (e) {
      this.setState('FAILED');
      throw e;
    }
  }

  async sampleThreads(): Promise<unknown> {
    this.setState('SAMPLING');
    try {
      const result = await this.sendCommand('sample-threads');
      this.setState('ATTACHED');
      return result;
    } catch (e) {
      this.setState('FAILED');
      throw e;
    }
  }

  async sampleHeap(): Promise<unknown> {
    this.setState('SAMPLING');
    try {
      const result = await this.sendCommand('sample-heap');
      this.setState('ATTACHED');
      return result;
    } catch (e) {
      this.setState('FAILED');
      throw e;
    }
  }

  async detach(): Promise<unknown> {
    this.setState('DETACHING');
    try {
      const result = await this.sendCommand('detach');
      this.setState('IDLE');
      return result;
    } catch (e) {
      this.setState('FAILED');
      throw e;
    }
  }

  async getStatus(): Promise<{ state: JavaHelperState; attachedPid?: string }> {
    if (!this.ready) return { state: this.state };
    try {
      const result = await this.sendCommand('status') as Record<string, unknown>;
      return (result.data as { state: JavaHelperState; attachedPid?: string }) ?? { state: this.state };
    } catch (err) {
      this.logger.debug('Failed to get status from helper process', err);
      return { state: this.state };
    }
  }

  async generateHeapDump(outputPath: string, liveObjectsOnly = true): Promise<unknown> {
    try {
      const result = await this.sendCommand('heap-dump', { outputPath, liveObjectsOnly });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async generateThreadDump(outputPath: string, includeLockedMonitors = true, includeLockedSynchronizers = true): Promise<unknown> {
    try {
      const result = await this.sendCommand('thread-dump', { 
        outputPath, 
        includeLockedMonitors, 
        includeLockedSynchronizers 
      });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async checkDiskSpace(path: string): Promise<unknown> {
    try {
      const result = await this.sendCommand('check-disk-space', { path });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async estimateHeapSize(): Promise<unknown> {
    try {
      const result = await this.sendCommand('estimate-heap-size');
      return result;
    } catch (e) {
      throw e;
    }
  }

  async startJfrRecording(options: { name?: string; durationSeconds?: number; maxSize?: number; maxAge?: number }): Promise<unknown> {
    try {
      const result = await this.sendCommand('jfr-start', options);
      return result;
    } catch (e) {
      throw e;
    }
  }

  async stopJfrRecording(recordingId: number, outputPath: string): Promise<unknown> {
    try {
      const result = await this.sendCommand('jfr-stop', { recordingId, outputPath });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async getJfrStatus(recordingId: number): Promise<unknown> {
    try {
      const result = await this.sendCommand('jfr-status', { recordingId });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async getJvmFlags(): Promise<unknown> {
    try {
      const result = await this.sendCommand('jvm-flags');
      return result;
    } catch (e) {
      throw e;
    }
  }

  async getClassLoadingInfo(): Promise<unknown> {
    try {
      const result = await this.sendCommand('class-loading');
      return result;
    } catch (e) {
      throw e;
    }
  }

  async getGcInfo(): Promise<unknown> {
    try {
      const result = await this.sendCommand('gc-info');
      return result;
    } catch (e) {
      throw e;
    }
  }

  async startCpuSampling(options: { durationSeconds?: number; intervalMs?: number }): Promise<unknown> {
    try {
      const result = await this.sendCommand('cpu-sampling', options);
      return result;
    } catch (e) {
      throw e;
    }
  }

  async shutdown(graceful: boolean, timeoutSeconds?: number): Promise<unknown> {
    try {
      const result = await this.sendCommand('shutdown', { 
        graceful, 
        timeoutSeconds: timeoutSeconds ?? 30 
      });
      return result;
    } catch (e) {
      throw e;
    }
  }

  private setState(s: JavaHelperState): void {
    this.state = s;
    this.emit('state-change', s);
  }

  private handleResponse(msg: Record<string, unknown>): void {
    // Try to match by command field since we simplified the protocol
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);
      if (msg.type === 'error') {
        pending.reject(new Error((msg.message as string) ?? 'Unknown error'));
      } else {
        pending.resolve(msg);
      }
      return;
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private async resolveJarPath(): Promise<string> {
    const candidates = [
      resolve(process.cwd(), '..', 'plugin', 'java-helper', 'build', 'libs', 'java-helper-1.0.0.jar'),
      resolve(process.cwd(), '..', 'java-helper', 'build', 'libs', 'java-helper-1.0.0.jar'),
    ];

    for (const candidate of candidates) {
      try {
        await stat(candidate);
        return candidate;
      } catch (err) {
        this.logger.debug(`Candidate jar not found: ${candidate}`, err);
        continue;
      }
    }

    throw new Error(`Java helper jar not found. Expected at: ${candidates.join(', ')}`);
  }

  /**
   * Scan a .jar file for entry classes (classes with public static void main).
   * Uses `jar -tf` to list entries, then identifies likely entry points by class naming.
   * If the helper process is running, delegates to it for deeper analysis.
   */
  async scanJar(jarPath: string): Promise<{
    readonly entryClasses: ReadonlyArray<{ className: string; isMainClass: boolean; source: string }>;
    readonly manifest: Record<string, string>;
    readonly totalClasses: number;
  }> {
    const absPath = resolve(jarPath);
    await stat(absPath); // throws if not exist

    // If Java helper is running, use it for deeper scan
    if (this.ready) {
      try {
        const result = await this.sendCommand('scan-jar', { jarPath: absPath }) as Record<string, unknown>;
        return (result.data ?? { entryClasses: [], manifest: {}, totalClasses: 0 }) as {
          readonly entryClasses: ReadonlyArray<{ className: string; isMainClass: boolean; source: string }>;
          readonly manifest: Record<string, string>;
          readonly totalClasses: number;
        };
      } catch (err) {
        this.logger.warn('Java helper scan-jar failed, falling back to jar listing', err);
      }
    }

    const stdout = await this.execJarCommand(['-tf', absPath], { timeout: 15_000 });
    const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const classFiles = lines.filter((line) => line.endsWith('.class'));
    const totalClasses = classFiles.length;
    const manifest = await this.readManifestFallback(absPath, lines);
    const entryClasses = createFallbackEntryClasses(manifest['Main-Class'], classFiles);

    return { entryClasses, manifest, totalClasses };
  }

  /**
   * Recommend JVM arguments based on jar analysis.
   */
  async recommendJvmArgs(jarPath: string, maxMemoryMb = 4096): Promise<{
    readonly recommended: readonly string[];
    readonly explanation: readonly string[];
  }> {
    const scanResult = await this.scanJar(jarPath);

    const recommended: string[] = [];
    const explanation: string[] = [];

    // Memory based on max
    const heapMb = Math.min(maxMemoryMb, 4096);
    recommended.push(`-Xms${Math.floor(heapMb / 2)}M`, `-Xmx${heapMb}M`);
    explanation.push(`初始堆 ${Math.floor(heapMb / 2)}MB，最大堆 ${heapMb}MB`);

    // G1GC for modern MC servers
    recommended.push('-XX:+UseG1GC');
    explanation.push('使用 G1 垃圾收集器（推荐 MC 服务器）');

    // Common MC optimization flags
    recommended.push('-XX:+ParallelRefProcEnabled');
    recommended.push('-XX:MaxGCPauseMillis=200');
    recommended.push('-XX:+UnlockExperimentalVMOptions');
    recommended.push('-XX:+DisableExplicitGC');
    recommended.push('-XX:G1NewSizePercent=30');
    recommended.push('-XX:G1MaxNewSizePercent=40');
    recommended.push('-XX:G1HeapRegionSize=8M');
    recommended.push('-XX:G1ReservePercent=20');
    recommended.push('-XX:G1MixedGCCountTarget=4');
    explanation.push('G1GC 优化参数，降低 GC 停顿');

    // Aikar's flags (standard MC optimization)
    recommended.push('-XX:InitiatingHeapOccupancyPercent=15');
    recommended.push('-XX:G1MixedGCLiveThresholdPercent=90');
    recommended.push('-XX:SurvivorRatio=32');
    explanation.push('Aikar 推荐的 MC 服务器 JVM 参数');

    if (scanResult.totalClasses > 5000) {
      recommended.push('-XX:+UseCompressedOops');
      explanation.push('大型插件包：启用压缩指针');
    }

    return { recommended, explanation };
  }

  private async execJarCommand(args: readonly string[], options: { cwd?: string; timeout: number }): Promise<string> {
    return new Promise((resolveOutput, rejectOutput) => {
      const child = execFile('jar', [...args], { cwd: options.cwd, timeout: options.timeout }, (err, stdout) => {
        if (err) {
          rejectOutput(new Error(`Failed to run jar ${args.join(' ')}: ${err.message}`));
          return;
        }
        resolveOutput(stdout);
      });

      child.on('error', () => rejectOutput(new Error('jar command not found')));
    });
  }

  private async readManifestFallback(absPath: string, jarEntries: readonly string[]): Promise<Record<string, string>> {
    if (!jarEntries.includes('META-INF/MANIFEST.MF')) {
      return {};
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'jianagent-jar-scan-'));
    try {
      await this.execJarCommand(['-xf', absPath, 'META-INF/MANIFEST.MF'], {
        cwd: tempDir,
        timeout: 5_000,
      });
      const manifestPath = join(tempDir, 'META-INF', 'MANIFEST.MF');
      const manifestText = await readFile(manifestPath, 'utf8');
      return parseManifestText(manifestText);
    } catch (error) {
      this.logger.warn(`Failed to parse manifest for ${absPath}: ${String(error)}`);
      return {};
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  onModuleDestroy(): void {
    this.process?.kill();
    this.rejectAllPending('Module destroyed');
  }
}

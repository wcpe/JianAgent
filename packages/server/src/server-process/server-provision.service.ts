import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { access, constants, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { PaperReleaseService } from '../local-validation/paper-release.service.js';
import { ServerConfigService } from './server-config.service.js';
import { ServerLifecycleEngine } from './lifecycle/lifecycle-engine.service.js';
import { JavaRuntimeService } from '../java-runtime/java-runtime.service.js';
import type { ProvisionServerRequest, ProvisionServerResponse, ProvisionPhase, PaperVersionInfo } from '@jian-agent/shared-domain';

@Injectable()
export class ServerProvisionService {
  private readonly logger = new Logger(ServerProvisionService.name);

  constructor(
    private readonly paperRelease: PaperReleaseService,
    private readonly configService: ServerConfigService,
    private readonly lifecycle: ServerLifecycleEngine,
    private readonly javaRuntime: JavaRuntimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async provision(req: ProvisionServerRequest): Promise<ProvisionServerResponse> {
    let serverId = '';
    const port = req.port ?? 25565;
    const maxMem = req.maxMemory ?? '2G';
    const minMem = req.minMemory ?? '512M';
    let jarPath = req.jarPath ?? '';

    try {
      // Phase 1: VALIDATING
      this.emitProgress(serverId, 'VALIDATING', 5, '正在验证配置...');

      if (!req.name?.trim()) throw new Error('服务器名称不能为空');
      if (!req.workDir?.trim()) throw new Error('工作目录不能为空');

      if (req.coreType === 'paper' && !req.minecraftVersion) {
        throw new Error('Paper 模式需要指定 Minecraft 版本');
      }
      if (req.coreType === 'custom' && !req.jarPath?.trim()) {
        throw new Error('自定义模式需要指定 JAR 路径');
      }

      const javaResolution = await this.javaRuntime.resolveJavaPath(req.runtimeId);
      const resolvedJavaPath = req.javaPath?.trim() || javaResolution.resolvedJavaPath;

      if (!await this.isPortAvailable(port)) {
        throw new Error(`端口 ${port} 已被占用`);
      }

      this.emitProgress(serverId, 'VALIDATING', 15, '配置验证通过');

      // Phase 2: CREATING_DIRECTORY
      this.emitProgress(serverId, 'CREATING_DIRECTORY', 20, '正在创建工作目录...');
      await mkdir(req.workDir, { recursive: true });
      this.emitProgress(serverId, 'CREATING_DIRECTORY', 25, '工作目录已创建');

      // Phase 3: DOWNLOADING_CORE
      if (req.coreType === 'paper') {
        this.emitProgress(serverId, 'DOWNLOADING_CORE', 30, `正在解析 Paper ${req.minecraftVersion} 版本信息...`);
        const descriptor = await this.paperRelease.resolveBuild(req.minecraftVersion!);

        this.emitProgress(serverId, 'DOWNLOADING_CORE', 40, `正在下载 ${descriptor.fileName}...`);
        const jarBytes = await this.paperRelease.downloadBuild(descriptor);

        jarPath = join(req.workDir, descriptor.fileName);
        await writeFile(jarPath, jarBytes);
        this.emitProgress(serverId, 'DOWNLOADING_CORE', 60, `${descriptor.fileName} 下载完成`);
      } else {
        this.emitProgress(serverId, 'DOWNLOADING_CORE', 35, '验证 JAR 文件...');
        try {
          await access(jarPath, constants.R_OK);
          const jarStat = await stat(jarPath);
          if (!jarStat.isFile()) throw new Error(`${jarPath} 不是文件`);
        } catch (err: any) {
          if (err.code === 'ENOENT') throw new Error(`JAR 文件不存在: ${jarPath}`);
          throw err;
        }
        this.emitProgress(serverId, 'DOWNLOADING_CORE', 60, 'JAR 文件验证通过');
      }

      // Phase 4: WRITING_CONFIG
      this.emitProgress(serverId, 'WRITING_CONFIG', 65, '正在写入配置文件...');

      if (req.agreeEula !== false) {
        await writeFile(join(req.workDir, 'eula.txt'), 'eula=true\n');
      }

      const serverProps = this.buildServerProperties(port, req.serverProperties);
      await writeFile(join(req.workDir, 'server.properties'), serverProps);
      this.emitProgress(serverId, 'WRITING_CONFIG', 72, '配置文件已写入');

      // Phase 5: CREATING_SERVER
      this.emitProgress(serverId, 'CREATING_SERVER', 75, '正在注册服务器...');

      const jvmArgs = [
        `-Xmx${maxMem}`,
        `-Xms${minMem}`,
        ...(req.jvmArgs ?? []),
      ];

      const serverConfig = await this.configService.create({
        name: req.name.trim(),
        serverType: 'managed',
        jarPath,
        workDir: req.workDir,
        host: '127.0.0.1',
        port,
        javaPath: resolvedJavaPath,
        runtimeId: req.runtimeId,
        jvmArgs,
        serverArgs: [...(req.serverArgs ?? []), 'nogui'],
        autoRestart: true,
        maxRestarts: 3,
        serverGroup: req.serverGroup,
        tags: req.tags ? [...req.tags] : undefined,
        description: req.description,
      });

      serverId = serverConfig.id;
      this.emitProgress(serverId, 'CREATING_SERVER', 80, '服务器已注册');

      // Phase 6: STARTING
      if (req.autoStart !== false) {
        this.emitProgress(serverId, 'STARTING', 85, '正在启动服务器...');
        try {
          await this.lifecycle.start(serverId, serverConfig);
          this.emitProgress(serverId, 'STARTING', 95, '服务器正在启动中');
        } catch (startErr: any) {
          this.logger.warn(`Server ${serverId} provisioned but failed to start: ${startErr.message}`);
          this.emitProgress(serverId, 'STARTING', 90, `启动失败: ${startErr.message}，可稍后手动启动`);
        }
      }

      // Phase 7: READY
      this.emitProgress(serverId, 'READY', 100, '服务器创建完成');

      return {
        serverId,
        name: req.name.trim(),
        workDir: req.workDir,
        jarPath,
        port,
      };
    } catch (err: any) {
      this.emitProgress(serverId, 'FAILED', 0, err.message, err.message);
      throw err;
    }
  }

  async listPaperVersions(): Promise<PaperVersionInfo[]> {
    const url = 'https://api.papermc.io/v2/projects/paper';
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch Paper versions: ${response.status}`);
    }
    const data = (await response.json()) as { versions?: string[] };
    const versions = Array.isArray(data.versions) ? data.versions : [];
    return versions
      .reverse()
      .slice(0, 20)
      .map((v) => ({ version: v, latestBuild: 0 }));
  }

  private emitProgress(
    serverId: string,
    phase: ProvisionPhase,
    progress: number,
    message: string,
    error?: string,
  ): void {
    this.eventEmitter.emit('server.provision.progress', {
      serverId,
      phase,
      progress,
      message,
      error,
      timestamp: Date.now(),
    });
  }

  private buildServerProperties(port: number, overrides?: Readonly<Record<string, string>>): string {
    const defaults: Record<string, string> = {
      'motd': 'A JianAgent Managed Server',
      'online-mode': 'false',
      'enforce-secure-profile': 'false',
      'server-port': String(port),
      'spawn-protection': '0',
      'gamemode': 'survival',
      'difficulty': 'easy',
      'pvp': 'true',
      'max-players': '20',
      'view-distance': '10',
      'simulation-distance': '10',
    };
    const merged = { ...defaults, ...overrides };
    return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once('error', () => resolve(false));
      server.listen({ port, exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    });
  }
}

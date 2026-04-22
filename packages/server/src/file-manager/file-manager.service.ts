import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ServerConfigService } from '../server-process/server-config.service.js';
import { LocalFileProvider } from './local-file.provider.js';
import { SftpFileService } from '../ssh/sftp-file.service.js';
import type { FileEntry, FileStat } from '../ssh/sftp-file.service.js';
import type { ServerConfig, SshConnectConfig } from '@jian-agent/shared-domain';
import { FileTaskExecutor } from './file-task.executor.js';

const ALLOWED_EXTENSIONS = new Set([
  '.jar', '.yml', '.yaml', '.properties', '.json', '.txt', '.cfg',
  '.conf', '.toml', '.log', '.md', '.xml', '.sh', '.bat', '.cmd',
  '.csv', '.ini',
]);

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

@Injectable()
export class FileManagerService {
  private readonly logger = new Logger(FileManagerService.name);

  constructor(
    private readonly configService: ServerConfigService,
    private readonly localFile: LocalFileProvider,
    private readonly sftpFile: SftpFileService,
    @Inject(forwardRef(() => FileTaskExecutor))
    private readonly taskExecutor: FileTaskExecutor,
  ) {}

  async listDir(serverId: string, path = ''): Promise<readonly FileEntry[]> {
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      return this.localFile.readDir(this.getRootDir(config), path);
    }
    return this.sftpFile.readDir(this.toSshConfig(config), path);
  }

  async readFile(serverId: string, path: string): Promise<{ content: string; encoding: string }> {
    const config = await this.requireConfig(serverId);
    let buf: Buffer;
    if (this.isLocal(config)) {
      buf = await this.localFile.readFileContent(this.getRootDir(config), path);
    } else {
      buf = await this.sftpFile.readFile(this.toSshConfig(config), path);
    }
    return { content: buf.toString('utf-8'), encoding: 'utf-8' };
  }

  async writeFile(serverId: string, path: string, content: string): Promise<void> {
    this.validateExtension(path);
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      await this.localFile.writeFileContent(this.getRootDir(config), path, content);
    } else {
      await this.sftpFile.writeFile(this.toSshConfig(config), path, content);
    }
  }

  async uploadFile(serverId: string, path: string, data: Buffer, filename: string): Promise<void> {
    this.validateExtension(filename);
    if (data.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large: ${(data.length / 1024 / 1024).toFixed(1)}MB exceeds 200MB limit`);
    }
    const config = await this.requireConfig(serverId);
    const fullPath = path ? `${path}/${filename}` : filename;
    if (this.isLocal(config)) {
      await this.localFile.writeFileContent(this.getRootDir(config), fullPath, data);
    } else {
      await this.sftpFile.uploadFile(this.toSshConfig(config), fullPath, data);
    }
  }

  async downloadFile(serverId: string, path: string): Promise<Buffer> {
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      return this.localFile.readFileContent(this.getRootDir(config), path);
    }
    return this.sftpFile.readFile(this.toSshConfig(config), path);
  }

  async deleteEntry(serverId: string, path: string): Promise<void> {
    if (!path) throw new BadRequestException('Cannot delete root directory');
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      await this.localFile.deleteEntry(this.getRootDir(config), path);
    } else {
      await this.sftpFile.deleteFile(this.toSshConfig(config), path);
    }
  }

  async mkdir(serverId: string, path: string): Promise<void> {
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      await this.localFile.mkdirEntry(this.getRootDir(config), path);
    } else {
      await this.sftpFile.mkdir(this.toSshConfig(config), path);
    }
  }

  async rename(serverId: string, oldPath: string, newPath: string): Promise<void> {
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      await this.localFile.renameEntry(this.getRootDir(config), oldPath, newPath);
    } else {
      await this.sftpFile.rename(this.toSshConfig(config), oldPath, newPath);
    }
  }

  async stat(serverId: string, path: string): Promise<FileStat> {
    const config = await this.requireConfig(serverId);
    if (this.isLocal(config)) {
      return this.localFile.statEntry(this.getRootDir(config), path);
    }
    return this.sftpFile.stat(this.toSshConfig(config), path);
  }

  /** Delegate a long-running batch copy to the task executor. */
  async copyAsync(
    serverId: string,
    sourcePaths: string[],
    targetPath: string,
  ) {
    return this.taskExecutor.submit({
      serverId,
      kind: 'DIR_COPY',
      sourcePaths,
      targetPath,
    });
  }

  /** Delegate a long-running batch move to the task executor. */
  async moveAsync(
    serverId: string,
    sourcePaths: string[],
    targetPath: string,
  ) {
    return this.taskExecutor.submit({
      serverId,
      kind: 'DIR_MOVE',
      sourcePaths,
      targetPath,
    });
  }

  private isLocal(config: ServerConfig): boolean {
    return config.serverType === 'managed' || !config.sshHost;
  }

  private toSshConfig(config: ServerConfig): SshConnectConfig {
    return this.configService.serverConfigToSshConfig(config);
  }

  private getRootDir(config: ServerConfig): string {
    const root = config.workDir || config.serverDir;
    if (!root) {
      throw new BadRequestException(
        'Server has no directory configured. Set workDir or serverDir (and SSH for remote servers).',
      );
    }
    return root;
  }

  private async requireConfig(serverId: string): Promise<ServerConfig> {
    const config = await this.configService.getById(serverId);
    if (!config) throw new NotFoundException(`Server not found: ${serverId}`);
    return config;
  }

  private validateExtension(filename: string): void {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`File extension not allowed: ${ext}`);
    }
  }
}

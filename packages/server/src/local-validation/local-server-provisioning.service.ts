import { Injectable } from '@nestjs/common';
import { createServer } from 'node:net';
import { access, constants, lstat, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { PaperReleaseService } from './paper-release.service.js';

export const LOCAL_VALIDATION_WORKSPACE_PREFIX = 'jianagent-local-validation-run-';

export function isManagedLocalValidationWorkspacePath(workspacePath: string): boolean {
  return dirname(workspacePath) === tmpdir() && basename(workspacePath).startsWith(LOCAL_VALIDATION_WORKSPACE_PREFIX);
}

export interface LocalServerPreflightIssue {
  readonly code:
    | 'INVALID_PORT'
    | 'PORT_NOT_AVAILABLE'
    | 'SERVER_DIR_NOT_ACCESSIBLE'
    | 'JAR_NOT_ACCESSIBLE'
    | 'JAR_NOT_A_FILE';
  readonly message: string;
}

export interface LocalServerPreflightReport {
  readonly valid: boolean;
  readonly blockingIssues: readonly LocalServerPreflightIssue[];
  readonly warnings: readonly string[];
}

export interface PaperWorkspaceInitializationResult {
  readonly jarPath: string;
  readonly workDir: string;
  readonly paperVersion: string;
  readonly build: number;
}

function buildServerProperties(port: number): string {
  return [
    'motd=JianAgent Local Validation',
    'online-mode=false',
    'enforce-secure-profile=false',
    `server-port=${port}`,
    'spawn-protection=0',
    'gamemode=survival',
    'difficulty=easy',
    'pvp=true',
    'spawn-monsters=false',
    'spawn-animals=false',
    'spawn-npcs=false',
    'max-players=32',
    'view-distance=6',
    'simulation-distance=6',
  ].join('\n') + '\n';
}

@Injectable()
export class LocalServerProvisioningService {
  constructor(private readonly paperReleaseService: PaperReleaseService) {}

  async preflightExistingDirectory(input: {
    readonly serverDir: string;
    readonly jarPath: string;
    readonly port: number;
  }): Promise<LocalServerPreflightReport> {
    const blockingIssues: LocalServerPreflightIssue[] = [];

    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
      blockingIssues.push({
        code: 'INVALID_PORT',
        message: `port ${input.port} is not a valid TCP port`,
      });
    } else if (!(await this.isPortAvailable(input.port))) {
      blockingIssues.push({
        code: 'PORT_NOT_AVAILABLE',
        message: `port ${input.port} is already in use`,
      });
    }

    try {
      await access(input.serverDir, constants.R_OK | constants.W_OK);
      const directoryStat = await stat(input.serverDir);
      if (!directoryStat.isDirectory()) {
        blockingIssues.push({
          code: 'SERVER_DIR_NOT_ACCESSIBLE',
          message: `serverDir ${input.serverDir} is not a directory`,
        });
      }
    } catch {
      blockingIssues.push({
        code: 'SERVER_DIR_NOT_ACCESSIBLE',
        message: `serverDir ${input.serverDir} cannot be accessed for read/write`,
      });
    }

    try {
      await access(input.jarPath, constants.R_OK);
      const jarStat = await stat(input.jarPath);
      if (!jarStat.isFile()) {
        blockingIssues.push({
          code: 'JAR_NOT_A_FILE',
          message: `jarPath ${input.jarPath} is not a file`,
        });
      }
    } catch {
      blockingIssues.push({
        code: 'JAR_NOT_ACCESSIBLE',
        message: `jarPath ${input.jarPath} cannot be read`,
      });
    }

    return {
      valid: blockingIssues.length === 0,
      blockingIssues,
      warnings: [],
    };
  }

  async initializePaperWorkspace(input: {
    readonly workspacePath: string;
    readonly version: string;
    readonly port: number;
  }): Promise<PaperWorkspaceInitializationResult> {
    await this.assertResettableWorkspace(input.workspacePath);
    const descriptor = await this.paperReleaseService.resolveBuild(input.version);
    const jarBytes = await this.paperReleaseService.downloadBuild(descriptor);

    await this.resetWorkspace(input.workspacePath);
    await mkdir(input.workspacePath, { recursive: true });

    const jarPath = join(input.workspacePath, descriptor.fileName);
    await writeFile(jarPath, jarBytes);
    await writeFile(join(input.workspacePath, 'eula.txt'), 'eula=true\n');
    await writeFile(join(input.workspacePath, 'server.properties'), buildServerProperties(input.port));

    return {
      jarPath,
      workDir: input.workspacePath,
      paperVersion: descriptor.version,
      build: descriptor.build,
    };
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    for (const host of ['0.0.0.0', '::'] as const) {
      const probe = await this.tryBind(host, port);
      if (probe === 'occupied') {
        return false;
      }
    }

    return true;
  }

  private async tryBind(host: string, port: number): Promise<'available' | 'occupied' | 'unsupported'> {
    return new Promise((resolve) => {
      const server = createServer();
      let settled = false;

      const finish = (result: 'available' | 'occupied' | 'unsupported') => {
        if (settled) {
          return;
        }
        settled = true;
        if (server.listening) {
          server.close(() => resolve(result));
          return;
        }

        resolve(result);
      };

      server.unref();
      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          finish('occupied');
          return;
        }

        if (error.code === 'EAFNOSUPPORT' || error.code === 'EINVAL' || error.code === 'EPROTONOSUPPORT' || error.code === 'ENOTSUP') {
          finish('unsupported');
          return;
        }

        finish('occupied');
      });

      server.listen({ host, port, exclusive: true }, () => {
        finish('available');
      });
    });
  }

  private async resetWorkspace(workspacePath: string): Promise<void> {
    await rm(workspacePath, { recursive: true, force: true });
  }

  private async assertResettableWorkspace(workspacePath: string): Promise<void> {
    if (!isManagedLocalValidationWorkspacePath(workspacePath)) {
      throw new Error(`workspacePath ${workspacePath} must stay inside the managed local validation workspace root`);
    }

    try {
      const workspaceStats = await lstat(workspacePath);
      if (workspaceStats.isSymbolicLink()) {
        throw new Error(`workspacePath ${workspacePath} must be a real directory, not a symbolic link`);
      }

      if (!workspaceStats.isDirectory()) {
        throw new Error(`workspacePath ${workspacePath} must be a real directory`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }
}

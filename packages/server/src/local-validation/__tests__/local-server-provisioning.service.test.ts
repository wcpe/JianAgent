import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { LOCAL_VALIDATION_WORKSPACE_PREFIX, LocalServerProvisioningService } from '../local-server-provisioning.service.js';
import { createServer } from 'node:net';
import { PaperReleaseService } from '../paper-release.service.js';

describe('LocalServerProvisioningService', () => {
  const root = join(tmpdir(), `jianagent-local-validation-task2-${randomUUID()}`);
  const managedWorkspaces: string[] = [];
  const managedWorkspaceSymlinks: string[] = [];

  const releaseService = {
    resolveBuild: vi.fn().mockResolvedValue({
      version: '1.21.1',
      build: 125,
      downloadUrl: 'https://example.invalid/paper-1.21.1-125.jar',
      fileName: 'paper-1.21.1-125.jar',
    }),
    downloadBuild: vi.fn().mockResolvedValue(Buffer.from('paper-jar-bytes')),
  };

  beforeEach(async () => {
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
  });

  afterEach(async () => {
    await Promise.all(managedWorkspaces.splice(0).map((workspacePath) => rm(workspacePath, { recursive: true, force: true })));
    await Promise.all(managedWorkspaceSymlinks.splice(0).map((workspacePath) => rm(workspacePath, { recursive: true, force: true })));
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('preflights an existing server directory', async () => {
    const existing = join(root, 'existing');
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, 'paper.jar'), 'jar');
    await writeFile(join(existing, 'eula.txt'), 'eula=true');
    await writeFile(join(existing, 'server.properties'), 'online-mode=false');

    const service = new LocalServerProvisioningService(releaseService as never);
    const report = await service.preflightExistingDirectory({
      serverDir: existing,
      jarPath: join(existing, 'paper.jar'),
      port: 25565,
    });

    expect(report.valid).toBe(true);
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.warnings).toEqual([]);

    await expect(access(existing)).resolves.toBeUndefined();
    await expect(stat(join(existing, 'paper.jar'))).resolves.toMatchObject({ size: 3 });
  });

  it('reports an occupied all-interfaces port as invalid during preflight', async () => {
    const occupiedServer = createServer();
    await new Promise<void>((resolve) => {
      occupiedServer.listen({ host: '0.0.0.0', port: 0 }, resolve);
    });
    const address = occupiedServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected an address info object');
    }

    const existing = join(root, 'existing-port-check');
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, 'paper.jar'), 'jar');

    try {
      const service = new LocalServerProvisioningService(releaseService as never);
      const report = await service.preflightExistingDirectory({
        serverDir: existing,
        jarPath: join(existing, 'paper.jar'),
        port: address.port,
      });

      expect(report.valid).toBe(false);
      expect(report.blockingIssues.some((issue) => issue.code === 'PORT_NOT_AVAILABLE')).toBe(true);
    } finally {
      await new Promise<void>((resolve) => occupiedServer.close(() => resolve()));
    }
  });

  it('initializes a paper workspace with jar, eula, and server properties', async () => {
    const workspace = await createManagedWorkspacePath();
    const service = new LocalServerProvisioningService(releaseService as never);

    const result = await service.initializePaperWorkspace({
      workspacePath: workspace,
      version: '1.21.1',
      port: 25591,
    });

    expect(releaseService.resolveBuild).toHaveBeenCalledWith('1.21.1');
    expect(releaseService.downloadBuild).toHaveBeenCalledWith({
      version: '1.21.1',
      build: 125,
      downloadUrl: 'https://example.invalid/paper-1.21.1-125.jar',
      fileName: 'paper-1.21.1-125.jar',
    });
    expect(result).toEqual({
      jarPath: join(workspace, 'paper-1.21.1-125.jar'),
      workDir: workspace,
      paperVersion: '1.21.1',
      build: 125,
    });

    await expect(access(join(workspace, 'paper-1.21.1-125.jar'))).resolves.toBeUndefined();
    await expect(access(join(workspace, 'eula.txt'))).resolves.toBeUndefined();
    await expect(access(join(workspace, 'server.properties'))).resolves.toBeUndefined();
    await expect(readFile(join(workspace, 'paper-1.21.1-125.jar'), 'utf8')).resolves.toBe('paper-jar-bytes');
    await expect(readFile(join(workspace, 'eula.txt'), 'utf8')).resolves.toBe('eula=true\n');
    await expect(readFile(join(workspace, 'server.properties'), 'utf8')).resolves.toBe(
      [
        'motd=JianAgent Local Validation',
        'online-mode=false',
        'enforce-secure-profile=false',
        'server-port=25591',
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
      ].join('\n') + '\n',
    );
  });

  it('removes stale workspace content before initializing a paper workspace', async () => {
    const workspace = await createManagedWorkspacePath();
    await mkdir(join(workspace, 'world'), { recursive: true });
    await writeFile(join(workspace, 'world', 'old-region.dat'), 'stale-data');
    await writeFile(join(workspace, 'old-plugin.jar'), 'stale-plugin');

    const service = new LocalServerProvisioningService(releaseService as never);
    await service.initializePaperWorkspace({
      workspacePath: workspace,
      version: '1.21.1',
      port: 25592,
    });

    await expect(access(join(workspace, 'world', 'old-region.dat'))).rejects.toThrow();
    await expect(access(join(workspace, 'old-plugin.jar'))).rejects.toThrow();
    await expect(readFile(join(workspace, 'paper-1.21.1-125.jar'), 'utf8')).resolves.toBe('paper-jar-bytes');
  });

  it('rejects a symlink workspace path before resetting it', async () => {
    const targetDirectory = join(root, 'symlink-target');
    const workspaceSymlink = join(tmpdir(), `${LOCAL_VALIDATION_WORKSPACE_PREFIX}${randomUUID()}`);
    managedWorkspaceSymlinks.push(workspaceSymlink);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, 'sentinel.txt'), 'keep-me');
    await symlink(targetDirectory, workspaceSymlink);

    const service = new LocalServerProvisioningService(releaseService as never);

    await expect(
      service.initializePaperWorkspace({
        workspacePath: workspaceSymlink,
        version: '1.21.1',
        port: 25593,
      }),
    ).rejects.toThrow(`workspacePath ${workspaceSymlink} must be a real directory, not a symbolic link`);

    await expect(readFile(join(targetDirectory, 'sentinel.txt'), 'utf8')).resolves.toBe('keep-me');
  });

  it('rejects a real directory outside the managed local validation workspace root', async () => {
    const externalWorkspace = join(root, 'outside-managed-root');
    await mkdir(externalWorkspace, { recursive: true });
    await writeFile(join(externalWorkspace, 'sentinel.txt'), 'keep-me');

    const service = new LocalServerProvisioningService(releaseService as never);

    await expect(
      service.initializePaperWorkspace({
        workspacePath: externalWorkspace,
        version: '1.21.1',
        port: 25594,
      }),
    ).rejects.toThrow(`workspacePath ${externalWorkspace} must stay inside the managed local validation workspace root`);

    await expect(readFile(join(externalWorkspace, 'sentinel.txt'), 'utf8')).resolves.toBe('keep-me');
  });

  async function createManagedWorkspacePath(): Promise<string> {
    const workspacePath = await mkdtemp(join(tmpdir(), LOCAL_VALIDATION_WORKSPACE_PREFIX));
    managedWorkspaces.push(workspacePath);
    return workspacePath;
  }
});

describe('PaperReleaseService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects resolveBuild when the Paper API responds with a non-OK status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new PaperReleaseService();

    await expect(service.resolveBuild('1.21.1')).rejects.toThrow(
      'Paper version lookup failed for 1.21.1: 500 Internal Server Error',
    );
  });

  it('rejects resolveBuild when no usable builds are returned', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ builds: [null, 'bad-build', 1.2] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new PaperReleaseService();

    await expect(service.resolveBuild('1.21.1')).rejects.toThrow('No Paper build found for 1.21.1');
  });

  it('rejects downloadBuild when the Paper download responds with a non-OK status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new PaperReleaseService();

    await expect(
      service.downloadBuild({
        version: '1.21.1',
        build: 125,
        downloadUrl: 'https://example.invalid/paper-1.21.1-125.jar',
        fileName: 'paper-1.21.1-125.jar',
      }),
    ).rejects.toThrow('Paper download failed for 1.21.1 build 125: 404 Not Found');
  });
});

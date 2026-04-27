import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { access, constants, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ResourceWorkspaceConfig,
  CreateResourceWorkspaceRequest,
  UpdateResourceWorkspaceRequest,
  QuickProvisionRequest,
  ProvisionServerResponse,
} from '@jian-agent/shared-domain';
import { ServerProvisionService } from '../server-process/server-provision.service.js';

@Injectable()
export class ResourceWorkspaceService {
  private readonly logger = new Logger(ResourceWorkspaceService.name);
  private readonly workspaces = new Map<string, ResourceWorkspaceConfig>();

  constructor(private readonly provisionService: ServerProvisionService) {}

  async findAll(): Promise<readonly ResourceWorkspaceConfig[]> {
    return Array.from(this.workspaces.values());
  }

  async findOne(id: string): Promise<ResourceWorkspaceConfig> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new NotFoundException(`Resource workspace ${id} not found`);
    }
    return workspace;
  }

  async create(req: CreateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    // Validate base path exists and is accessible
    try {
      await access(req.basePath, constants.R_OK | constants.W_OK);
    } catch (err: any) {
      throw new BadRequestException(`Base path ${req.basePath} is not accessible: ${err.message}`);
    }

    // If setting as default, unset other defaults
    if (req.isDefault) {
      for (const ws of this.workspaces.values()) {
        if (ws.isDefault) {
          this.workspaces.set(ws.id, { ...ws, isDefault: false });
        }
      }
    }

    const config: ResourceWorkspaceConfig = {
      id: randomUUID(),
      name: req.name,
      basePath: req.basePath,
      description: req.description,
      isDefault: req.isDefault ?? false,
      createdAt: new Date().toISOString(),
    };

    this.workspaces.set(config.id, config);
    this.logger.log(`Created resource workspace: ${config.name} at ${config.basePath}`);
    return config;
  }

  async update(id: string, req: UpdateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    const existing = await this.findOne(id);

    if (req.basePath && req.basePath !== existing.basePath) {
      try {
        await access(req.basePath, constants.R_OK | constants.W_OK);
      } catch (err: any) {
        throw new BadRequestException(`Base path ${req.basePath} is not accessible: ${err.message}`);
      }
    }

    if (req.isDefault) {
      for (const ws of this.workspaces.values()) {
        if (ws.id !== id && ws.isDefault) {
          this.workspaces.set(ws.id, { ...ws, isDefault: false });
        }
      }
    }

    const updated: ResourceWorkspaceConfig = {
      ...existing,
      name: req.name ?? existing.name,
      basePath: req.basePath ?? existing.basePath,
      description: req.description ?? existing.description,
      isDefault: req.isDefault ?? existing.isDefault,
    };

    this.workspaces.set(id, updated);
    this.logger.log(`Updated resource workspace: ${updated.name}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const workspace = await this.findOne(id);
    this.workspaces.delete(id);
    this.logger.log(`Deleted resource workspace: ${workspace.name}`);
  }

  async listServersInWorkspace(id: string): Promise<readonly string[]> {
    const workspace = await this.findOne(id);
    try {
      const entries = await readdir(workspace.basePath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err: any) {
      this.logger.warn(`Failed to list servers in workspace ${id}: ${err.message}`);
      return [];
    }
  }

  async quickProvision(req: QuickProvisionRequest): Promise<ProvisionServerResponse> {
    const workspace = await this.findOne(req.workspaceId);

    // Generate server directory name
    const serverDirName = req.serverName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const workDir = join(workspace.basePath, serverDirName);

    // Ensure directory doesn't exist
    try {
      await access(workDir);
      throw new BadRequestException(`Server directory already exists: ${serverDirName}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Create directory
    await mkdir(workDir, { recursive: true });

    // Provision server using existing provision service
    return this.provisionService.provision({
      name: req.serverName,
      coreType: 'paper',
      minecraftVersion: req.minecraftVersion,
      workDir,
      port: req.port,
      maxMemory: req.maxMemory,
      minMemory: req.minMemory,
      runtimeId: req.runtimeId,
      agreeEula: true,
      autoStart: false,
      serverGroup: req.serverGroup,
      tags: req.tags,
    });
  }
}

import type {
  ResourceWorkspaceConfig,
  CreateResourceWorkspaceRequest,
  UpdateResourceWorkspaceRequest,
  QuickProvisionRequest,
  ProvisionServerResponse,
} from '@jian-agent/shared-domain';

const BASE = '/api/v1/resource-workspaces';

export const resourceWorkspaceApi = {
  async findAll(): Promise<readonly ResourceWorkspaceConfig[]> {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`Failed to fetch resource workspaces: ${res.status}`);
    return res.json();
  },

  async findOne(id: string): Promise<ResourceWorkspaceConfig> {
    const res = await fetch(`${BASE}/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch resource workspace: ${res.status}`);
    return res.json();
  },

  async create(req: CreateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to create resource workspace: ${res.status}`);
    }
    return res.json();
  },

  async update(id: string, req: UpdateResourceWorkspaceRequest): Promise<ResourceWorkspaceConfig> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to update resource workspace: ${res.status}`);
    }
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete resource workspace: ${res.status}`);
  },

  async listServers(id: string): Promise<readonly string[]> {
    const res = await fetch(`${BASE}/${id}/servers`);
    if (!res.ok) throw new Error(`Failed to list servers: ${res.status}`);
    return res.json();
  },

  async quickProvision(req: QuickProvisionRequest): Promise<ProvisionServerResponse> {
    const res = await fetch(`${BASE}/quick-provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to provision server: ${res.status}`);
    }
    return res.json();
  },
};

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { CatalogService } from '../catalog/catalog.service.js';

describe('CatalogService', () => {
  let sqlite: Database.Database;
  let service: CatalogService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE cp_tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE cp_environments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE cp_clusters (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, environment_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE cp_hosts (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, environment_id TEXT NOT NULL, cluster_id TEXT NOT NULL, hostname TEXT NOT NULL, ip TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE cp_applications (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, environment_id TEXT NOT NULL, name TEXT NOT NULL, runtime_type TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE cp_instances (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, environment_id TEXT NOT NULL, application_id TEXT NOT NULL, host_id TEXT NOT NULL, runtime_type TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL);
    `);
    service = new CatalogService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates and lists tenant-scoped resources', async () => {
    const tenant = service.createTenant({ name: 'tenant-a' });
    const env = service.createEnvironment({ tenantId: tenant.id, name: 'prod' });
    const cluster = service.createCluster({ tenantId: tenant.id, environmentId: env.id, name: 'c1' });
    const host = service.createHost({
      tenantId: tenant.id,
      environmentId: env.id,
      clusterId: cluster.id,
      hostname: 'h1',
      ip: '10.0.0.1',
    });
    const app = service.createApplication({
      tenantId: tenant.id,
      environmentId: env.id,
      name: 'order-service',
      runtimeType: 'jar',
    });
    service.createInstance({
      tenantId: tenant.id,
      environmentId: env.id,
      applicationId: app.id,
      hostId: host.id,
      runtimeType: 'jar',
    });

    const result = await service.listApplications(tenant.id);
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe(tenant.id);
    expect(service.listInstances(tenant.id)).toHaveLength(1);
  });
});

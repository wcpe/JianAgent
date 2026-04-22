import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { ApplicationSummaryDto } from '@jian-agent/shared-domain';
import type { DrizzleDb } from '../../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../../storage/drizzle.provider.js';
import {
  cpApplications,
  cpClusters,
  cpEnvironments,
  cpHosts,
  cpInstances,
  cpTenants,
} from '../../storage/schema.js';

@Injectable()
export class CatalogService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  createTenant(input: { name: string }) {
    const now = new Date();
    const row = { id: randomUUID(), name: input.name, createdAt: now };
    this.db.insert(cpTenants).values(row).run();
    return row;
  }

  listTenants() {
    return this.db.select().from(cpTenants).all();
  }

  createEnvironment(input: { tenantId: string; name: string }) {
    const row = {
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      createdAt: new Date(),
    };
    this.db.insert(cpEnvironments).values(row).run();
    return row;
  }

  listEnvironments(tenantId: string) {
    return this.db
      .select()
      .from(cpEnvironments)
      .where(eq(cpEnvironments.tenantId, tenantId))
      .all();
  }

  createCluster(input: { tenantId: string; environmentId: string; name: string }) {
    const row = {
      id: randomUUID(),
      tenantId: input.tenantId,
      environmentId: input.environmentId,
      name: input.name,
      createdAt: new Date(),
    };
    this.db.insert(cpClusters).values(row).run();
    return row;
  }

  listClusters(tenantId: string) {
    return this.db.select().from(cpClusters).where(eq(cpClusters.tenantId, tenantId)).all();
  }

  createHost(input: {
    tenantId: string;
    environmentId: string;
    clusterId: string;
    hostname: string;
    ip: string;
  }) {
    const row = { id: randomUUID(), createdAt: new Date(), ...input };
    this.db.insert(cpHosts).values(row).run();
    return row;
  }

  listHosts(tenantId: string) {
    return this.db.select().from(cpHosts).where(eq(cpHosts.tenantId, tenantId)).all();
  }

  createApplication(input: {
    tenantId: string;
    environmentId: string;
    name: string;
    runtimeType: 'jar' | 'container';
  }) {
    const row = { id: randomUUID(), createdAt: new Date(), ...input };
    this.db.insert(cpApplications).values(row).run();
    return row;
  }

  async listApplications(tenantId: string): Promise<ApplicationSummaryDto[]> {
    const rows = this.db
      .select()
      .from(cpApplications)
      .where(eq(cpApplications.tenantId, tenantId))
      .all();
    return rows.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      environmentId: item.environmentId,
      name: item.name,
      runtimeType: item.runtimeType as 'jar' | 'container',
    }));
  }

  createInstance(input: {
    tenantId: string;
    environmentId: string;
    applicationId: string;
    hostId: string;
    runtimeType: 'jar' | 'container';
  }) {
    const row = {
      id: randomUUID(),
      state: 'stopped',
      createdAt: new Date(),
      ...input,
    };
    this.db.insert(cpInstances).values(row).run();
    return row;
  }

  listInstances(tenantId: string) {
    return this.db
      .select()
      .from(cpInstances)
      .where(eq(cpInstances.tenantId, tenantId))
      .all();
  }
}

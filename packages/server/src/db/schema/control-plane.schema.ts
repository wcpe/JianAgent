import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core';

export const cpTenants = sqliteTable('cp_tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpEnvironments = sqliteTable('cp_environments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpApplications = sqliteTable('cp_applications', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  environmentId: text('environment_id').notNull(),
  name: text('name').notNull(),
  runtimeType: text('runtime_type', { enum: ['jar', 'container'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpClusters = sqliteTable('cp_clusters', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  environmentId: text('environment_id').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpHosts = sqliteTable('cp_hosts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  environmentId: text('environment_id').notNull(),
  clusterId: text('cluster_id').notNull(),
  hostname: text('hostname').notNull(),
  ip: text('ip').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpInstances = sqliteTable('cp_instances', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  environmentId: text('environment_id').notNull(),
  applicationId: text('application_id').notNull(),
  hostId: text('host_id').notNull(),
  runtimeType: text('runtime_type', { enum: ['jar', 'container'] }).notNull(),
  state: text('state').notNull().default('stopped'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpOperationJobs = sqliteTable('cp_operation_jobs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  operation: text('operation').notNull(),
  target: text('target').notNull(),
  version: text('version').notNull(),
  batch: text('batch').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  status: text('status').notNull(),
  danger: integer('danger', { mode: 'boolean' }).notNull().default(false),
  validationPlanId: text('validation_plan_id'),
  validationRunId: text('validation_run_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cpApprovalTickets = sqliteTable('cp_approval_tickets', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  state: text('state').notNull().default('pending'),
  confirmationCode: text('confirmation_code').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** SP-17: Worker WebSocket events */

import type { WorkerEventDto, MetricSummaryDto } from '@jian-agent/shared-domain';

export const WorkerChannel = {
  WORKER_EVENT: 'task:worker:event',
  METRIC_SUMMARY: 'resource:metric:summary',
} as const;

export type WorkerChannel = (typeof WorkerChannel)[keyof typeof WorkerChannel];

export interface WorkerEventPayload extends WorkerEventDto {}

export interface MetricSummaryPayload extends MetricSummaryDto {}

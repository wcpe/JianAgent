import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { JmxMetricSnapshotDto, JmxMetricBucketDto } from '@jian-agent/shared-domain';
import { JvmCapabilityFacade } from '../java-helper/jvm-capability.facade.js';

@Injectable()
export class JmxMetricsService extends EventEmitter {
  constructor(
    private readonly jvmFacade: JvmCapabilityFacade,
  ) {
    super();
  }

  async collectSnapshot(input: { serverId: string; pid: string }): Promise<JmxMetricSnapshotDto> {
    const snapshot = await this.jvmFacade.collectJmxSnapshot({
      serverId: input.serverId,
      pid: input.pid,
    });
    this.emit('jmx.snapshot', snapshot);
    return snapshot;
  }

  async getLatest(serverId: string): Promise<JmxMetricSnapshotDto | undefined> {
    return this.jvmFacade.getLatestJmx(serverId);
  }

  async getHistory(input: {
    serverId: string;
    startTime: string;
    endTime: string;
    limit?: number;
  }): Promise<readonly JmxMetricSnapshotDto[]> {
    return this.jvmFacade.getJmxHistory(input);
  }

  async getAggregatedHistory(input: {
    serverId: string;
    startTime: string;
    endTime: string;
    intervalSec: number;
    limit?: number;
  }): Promise<readonly JmxMetricBucketDto[]> {
    return this.jvmFacade.getAggregatedJmxHistory(input);
  }
}

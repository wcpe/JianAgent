import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { LogAggregatorService } from './log-aggregator.service.js';
import { AlertEngineService } from './alert-engine.service.js';
import { createLogEntryMessage, createAlertFiredMessage, createWsMessage, WsChannel } from '@jian-agent/shared-protocol';
import type { LogEntryDto, AlertDto, JmxMetricSnapshotDto } from '@jian-agent/shared-domain';
import { JmxMetricsService } from './jmx-metrics.service.js';

@Injectable()
export class MetricsRealtimeWiring implements OnModuleInit, OnModuleDestroy {
  private logHandler: ((entry: LogEntryDto) => void) | null = null;
  private alertHandler: ((alert: AlertDto) => void) | null = null;
  private jmxHandler: ((snapshot: JmxMetricSnapshotDto) => void) | null = null;

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logAggregator: LogAggregatorService,
    private readonly alertEngine: AlertEngineService,
    private readonly jmxMetricsService: JmxMetricsService,
  ) {}

  onModuleInit(): void {
    this.logHandler = (entry: LogEntryDto) => {
      this.realtimeGateway.broadcastRaw(createLogEntryMessage(entry));
    };

    this.alertHandler = (alert: AlertDto) => {
      this.realtimeGateway.broadcastRaw(createAlertFiredMessage(alert));
    };

    this.logAggregator.on('log.entry', this.logHandler);
    this.alertEngine.on('alert.fired', this.alertHandler);

    this.jmxHandler = (snapshot: JmxMetricSnapshotDto) => {
      this.realtimeGateway.broadcastRaw(
        createWsMessage(WsChannel.RESOURCE_METRIC_SUMMARY as any, {
          type: 'jmx',
          snapshot,
        }),
      );
    };
    this.jmxMetricsService.on('jmx.snapshot', this.jmxHandler);
  }

  onModuleDestroy(): void {
    if (this.logHandler) this.logAggregator.removeListener('log.entry', this.logHandler);
    if (this.alertHandler) this.alertEngine.removeListener('alert.fired', this.alertHandler);
    if (this.jmxHandler) this.jmxMetricsService.removeListener('jmx.snapshot', this.jmxHandler);
  }
}

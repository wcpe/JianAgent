import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';
import { PlatformRuntimeModule } from '../platform-runtime/platform-runtime.module.js';
import { AlertEngineService } from './alert-engine.service.js';
import { AlertStoreService } from './alert-store.service.js';
import { LogAggregatorService } from './log-aggregator.service.js';
import { LogStoreService } from './log-store.service.js';
import { LogExporterService } from './log-exporter.service.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsRealtimeWiring } from './metrics-realtime.wiring.js';
import { SessionReportService } from './session-report.service.js';
import { ReportExporterService } from './report-exporter.service.js';
import { JmxMetricsService } from './jmx-metrics.service.js';
import { JmxSchedulerService } from './jmx-scheduler.service.js';
import { MonitoringOverviewService } from './monitoring-overview.service.js';

@Module({
  imports: [StorageModule, JavaHelperModule, PlatformRuntimeModule],
  controllers: [MetricsController],
  providers: [AlertEngineService, AlertStoreService, LogAggregatorService, LogStoreService, LogExporterService, MetricsRealtimeWiring, SessionReportService, ReportExporterService, JmxMetricsService, JmxSchedulerService, MonitoringOverviewService],
  exports: [AlertEngineService, AlertStoreService, LogAggregatorService, LogStoreService, LogExporterService, SessionReportService, ReportExporterService, JmxMetricsService, JmxSchedulerService, MonitoringOverviewService],
})
export class MetricsModule {}

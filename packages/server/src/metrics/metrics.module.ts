import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';
import { PlatformRuntimeModule } from '../platform-runtime/platform-runtime.module.js';
import { LogFileModule } from '../log-file/log-file.module.js';
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
import { SystemMetricsService } from './system-metrics.service.js';
import { CorrelatedTimelineService } from './correlated-timeline.service.js';

@Module({
  imports: [StorageModule, forwardRef(() => JavaHelperModule), PlatformRuntimeModule, forwardRef(() => LogFileModule)],
  controllers: [MetricsController],
  providers: [AlertEngineService, AlertStoreService, LogAggregatorService, LogStoreService, LogExporterService, MetricsRealtimeWiring, SessionReportService, ReportExporterService, JmxMetricsService, JmxSchedulerService, MonitoringOverviewService, SystemMetricsService, CorrelatedTimelineService],
  exports: [AlertEngineService, AlertStoreService, LogAggregatorService, LogStoreService, LogExporterService, SessionReportService, ReportExporterService, JmxMetricsService, JmxSchedulerService, MonitoringOverviewService, SystemMetricsService, CorrelatedTimelineService],
})
export class MetricsModule {}

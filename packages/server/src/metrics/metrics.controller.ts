import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { LogAggregatorService } from './log-aggregator.service.js';
import { AlertEngineService } from './alert-engine.service.js';
import { AlertStoreService } from './alert-store.service.js';
import { MonitoringOverviewService } from './monitoring-overview.service.js';
import { LogExporterService } from './log-exporter.service.js';
import { MetricStoreService } from '../storage/metric-store.service.js';
import { JmxMetricsService } from './jmx-metrics.service.js';
import { JmxSchedulerService } from './jmx-scheduler.service.js';
import { SystemMetricsService } from './system-metrics.service.js';
import { CorrelatedTimelineService } from './correlated-timeline.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import type { LogSearchRequest, CreateAlertRuleDto, UpdateAlertRuleDto } from '@jian-agent/shared-domain';

@Controller('metrics')
@UseGuards(JwtGuard, RolesGuard)
export class MetricsController {
  constructor(
    private readonly logAggregator: LogAggregatorService,
    private readonly alertEngine: AlertEngineService,
    private readonly alertStore: AlertStoreService,
    private readonly logExporter: LogExporterService,
    private readonly metricStore: MetricStoreService,
    private readonly jmxMetrics: JmxMetricsService,
    private readonly jmxScheduler: JmxSchedulerService,
    private readonly monitoringOverview: MonitoringOverviewService,
    private readonly systemMetricsService: SystemMetricsService,
    private readonly correlatedTimeline: CorrelatedTimelineService,
  ) {}

  // --- Metrics History ---

  @Get('history')
  @Roles(RoleLevel.VIEWER)
  async getHistory(
    @Query('serverId') serverId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = serverId ?? 'default';
    const end = endTime ?? new Date().toISOString();
    const start = startTime ?? new Date(Date.now() - 3600_000).toISOString();
    const lim = limit ? parseInt(limit, 10) : 60;
    const data = await this.metricStore.queryRange(sid, start, end, lim);
    return { success: true, data };
  }

  @Get('latest')
  @Roles(RoleLevel.VIEWER)
  async getLatest(@Query('serverId') serverId?: string) {
    const data = await this.metricStore.getLatest(serverId ?? 'default');
    return { success: true, data: data ?? null };
  }

  @Get('worlds')
  @Roles(RoleLevel.VIEWER)
  async getWorldMetrics(
    @Query('serverId') serverId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = serverId ?? 'default';
    const end = endTime ?? new Date().toISOString();
    const start = startTime ?? new Date(Date.now() - 3600_000).toISOString();
    const lim = limit ? parseInt(limit, 10) : 60;
    const data = await this.metricStore.queryWorldMetrics(sid, start, end, lim);
    return { success: true, data };
  }

  @Delete('retention')
  @Roles(RoleLevel.ADMIN)
  async cleanupOldMetrics(@Query('days') days?: string) {
    const retentionDays = days ? parseInt(days, 10) : 7;
    const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
    await this.metricStore.deleteOlderThan(cutoff);
    return { success: true, message: `Deleted metrics older than ${retentionDays} days` };
  }

  @Post('jmx/collect')
  @Roles(RoleLevel.DANGER)
  async collectJmx(@Body() body: { serverId: string; pid: string }) {
    const data = await this.jmxMetrics.collectSnapshot(body);
    return { success: true, data };
  }

  @Get('jmx/latest')
  @Roles(RoleLevel.VIEWER)
  async getLatestJmx(@Query('serverId') serverId?: string) {
    const data = await this.jmxMetrics.getLatest(serverId ?? 'default');
    return { success: true, data: data ?? null };
  }

  @Get('jmx/history')
  @Roles(RoleLevel.VIEWER)
  async getJmxHistory(
    @Query('serverId') serverId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = serverId ?? 'default';
    const end = endTime ?? new Date().toISOString();
    const start = startTime ?? new Date(Date.now() - 3600_000).toISOString();
    const lim = limit ? parseInt(limit, 10) : 60;
    const data = await this.jmxMetrics.getHistory({
      serverId: sid,
      startTime: start,
      endTime: end,
      limit: lim,
    });
    return { success: true, data };
  }

  @Get('jmx/history-aggregated')
  @Roles(RoleLevel.VIEWER)
  async getJmxHistoryAggregated(
    @Query('serverId') serverId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('intervalSec') intervalSec?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = serverId ?? 'default';
    const end = endTime ?? new Date().toISOString();
    const start = startTime ?? new Date(Date.now() - 3600_000).toISOString();
    const interval = intervalSec ? parseInt(intervalSec, 10) : 300;
    const lim = limit ? parseInt(limit, 10) : 60;
    const data = await this.jmxMetrics.getAggregatedHistory({
      serverId: sid,
      startTime: start,
      endTime: end,
      intervalSec: interval,
      limit: lim,
    });
    return { success: true, data };
  }

  @Post('jmx/schedules')
  @Roles(RoleLevel.DANGER)
  async createJmxSchedule(
    @Body()
    body: {
      serverId: string;
      pid: string;
      intervalSec: number;
      heapUsedThresholdMb?: number;
      threadThreshold?: number;
    },
  ) {
    const data = await this.jmxScheduler.createSchedule(body);
    return { success: true, data };
  }

  @Get('jmx/schedules')
  @Roles(RoleLevel.VIEWER)
  listJmxSchedules() {
    return { success: true, data: this.jmxScheduler.listSchedules() };
  }

  @Delete('jmx/schedules/:id')
  @Roles(RoleLevel.DANGER)
  removeJmxSchedule(@Param('id') id: string) {
    return { success: true, data: { removed: this.jmxScheduler.removeSchedule(id) } };
  }

  // --- Logs ---

  @Get('logs')
  @Roles(RoleLevel.VIEWER)
  getLogs(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('level') level?: string,
    @Query('source') source?: string,
    @Query('module') module?: string,
    @Query('search') search?: string,
    @Query('serverId') serverId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: LogSearchRequest = {
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      level: level || undefined,
      source: source || undefined,
      q: search || undefined,
      hosts: serverId ? [serverId] : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.logAggregator.query(query);
  }

  @Get('logs/export')
  @Roles(RoleLevel.OPERATOR)
  async exportLogs(
    @Query('format') format: string,
    @Query('level') level?: string,
    @Query('source') source?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const filters = { level, source, startTime, endTime };
    const exportFormat = format === 'json' ? 'json' : 'csv';
    const stream = exportFormat === 'csv'
      ? await this.logExporter.exportCsv(filters)
      : await this.logExporter.exportJson(filters);
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    }
    return { success: true, data: chunks.join(''), format: exportFormat };
  }

  // --- Alerts ---

  @Get('alerts')
  @Roles(RoleLevel.VIEWER)
  async getAlerts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('level') level?: string,
    @Query('acknowledged') acknowledged?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const all = await this.alertEngine.getRecentAlerts(1000);
    let filtered = all;
    if (level) {
      filtered = filtered.filter((a) => a.level === level);
    }
    if (acknowledged === 'true') {
      filtered = filtered.filter((a) => a.acknowledged);
    } else if (acknowledged === 'false') {
      filtered = filtered.filter((a) => !a.acknowledged);
    }
    const total = filtered.length;
    const start = (parsedPage - 1) * parsedLimit;
    const data = filtered.slice(start, start + parsedLimit);
    return { data, total, page: parsedPage, limit: parsedLimit };
  }

  @Get('alerts/summary')
  @Roles(RoleLevel.VIEWER)
  getAlertSummary() {
    return this.alertEngine.getSummary();
  }

  @Get('overview')
  @Roles(RoleLevel.VIEWER)
  getMonitoringOverview(@Query('serverId') serverId?: string) {
    return this.monitoringOverview.getOverview(serverId ?? 'default');
  }

  @Post('alerts/:id/acknowledge')
  @Roles(RoleLevel.OPERATOR)
  acknowledgeAlert(@Param('id') id: string) {
    return this.alertEngine.acknowledgeAlert(id);
  }

  // --- Alert Rules ---

  @Get('alert-rules')
  @Roles(RoleLevel.VIEWER)
  async getAlertRules(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const all = await this.alertStore.listRules();
    const total = all.length;
    const start = (parsedPage - 1) * parsedLimit;
    const data = all.slice(start, start + parsedLimit);
    return { data, total, page: parsedPage, limit: parsedLimit };
  }

  @Post('alert-rules')
  @Roles(RoleLevel.ADMIN)
  createAlertRule(@Body() dto: CreateAlertRuleDto) {
    return this.alertStore.createRule(dto).then(async (rule) => {
      await this.alertEngine.reloadRules();
      return rule;
    });
  }

  @Patch('alert-rules/:id')
  @Roles(RoleLevel.ADMIN)
  updateAlertRule(@Param('id') id: string, @Body() dto: UpdateAlertRuleDto) {
    return this.alertStore.updateRule(id, dto).then(async (rule) => {
      await this.alertEngine.reloadRules();
      return rule;
    });
  }

  @Delete('alert-rules/:id')
  @Roles(RoleLevel.ADMIN)
  deleteAlertRule(@Param('id') id: string) {
    return this.alertStore.deleteRule(id).then(async (result) => {
      await this.alertEngine.reloadRules();
      return { deleted: result };
    });
  }

  // --- System Metrics ---

  @Get('system/latest')
  @Roles(RoleLevel.VIEWER)
  getSystemLatest() {
    return { success: true, data: this.systemMetricsService.getLatest() };
  }

  @Get('system/history')
  @Roles(RoleLevel.VIEWER)
  getSystemHistory(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(500, parseInt(limitStr ?? '120', 10) || 120);
    return { success: true, data: this.systemMetricsService.getHistory(startTime, endTime, limit) };
  }

  @Get('system/summary')
  @Roles(RoleLevel.VIEWER)
  getSystemSummary() {
    const latest = this.systemMetricsService.getLatest();
    return { success: true, data: latest };
  }

  // --- Correlated Timeline ---

  @Get('correlated')
  @Roles(RoleLevel.VIEWER)
  async getCorrelatedTimeline(
    @Query('serverId') serverId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    const data = await this.correlatedTimeline.getCorrelatedTimeline(serverId, startTime, endTime);
    return { success: true, data };
  }
}

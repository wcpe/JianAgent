import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { ValidationPlanService } from './validation-plan.service.js';
import { ValidationRunService } from './validation-run.service.js';
import { QuickValidationService } from './quick-validation.service.js';
import { ValidationReportService, type VerdictThresholds } from './validation-report.service.js';
import { PlatformObservabilityService } from '../platform-observability/platform-observability.service.js';
import { SessionReportService } from '../metrics/session-report.service.js';

@Controller('validation')
@UseGuards(JwtGuard, RolesGuard)
export class ValidationController {
  constructor(
    private readonly planService: ValidationPlanService,
    private readonly runService: ValidationRunService,
    private readonly quickValidation: QuickValidationService,
    private readonly reportService: ValidationReportService,
    private readonly observabilityService: PlatformObservabilityService,
    private readonly sessionReportService: SessionReportService,
  ) {}

  // --- Validation Plans ---

  @Get('plans')
  @Roles(RoleLevel.VIEWER)
  async listPlans() {
    const data = await this.planService.findAll();
    return { success: true, data };
  }

  @Get('plans/:id')
  @Roles(RoleLevel.VIEWER)
  async getPlan(@Param('id') id: string) {
    const data = await this.planService.findById(id);
    if (!data) {
      throw new NotFoundException(`Plan ${id} not found`);
    }
    return { success: true, data };
  }

  @Post('plans')
  @Roles(RoleLevel.OPERATOR)
  async createPlan(@Body() body: {
    name: string;
    serverId: string;
    description?: string;
    type?: 'full' | 'quick' | 'custom';
    config?: Record<string, unknown>;
  }) {
    const data = await this.planService.create(body);
    return { success: true, data };
  }

  @Patch('plans/:id')
  @Roles(RoleLevel.OPERATOR)
  async updatePlan(@Param('id') id: string, @Body() body: {
    name?: string;
    description?: string;
    type?: 'full' | 'quick' | 'custom';
    config?: Record<string, unknown>;
    enabled?: boolean;
  }) {
    const data = await this.planService.update(id, body);
    return { success: true, data };
  }

  @Delete('plans/:id')
  @Roles(RoleLevel.ADMIN)
  async deletePlan(@Param('id') id: string) {
    await this.planService.delete(id);
    return { success: true };
  }

  // --- Validation Runs ---

  @Get('runs')
  @Roles(RoleLevel.VIEWER)
  async listRuns(@Query('planId') planId?: string) {
    const data = planId
      ? await this.runService.findByPlanId(planId)
      : await this.runService.findAll();
    return { success: true, data };
  }

  @Get('runs/:id')
  @Roles(RoleLevel.VIEWER)
  async getRun(@Param('id') id: string) {
    const data = await this.runService.findById(id);
    if (!data) {
      throw new NotFoundException(`Run ${id} not found`);
    }
    return { success: true, data };
  }

  @Post('plans/:planId/run')
  @Roles(RoleLevel.OPERATOR)
  async startRun(@Param('planId') planId: string) {
    const plan = await this.planService.findById(planId);
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    const data = await this.runService.create(planId, plan.serverId);
    return { success: true, data };
  }

  @Post('runs/:id/cancel')
  @Roles(RoleLevel.OPERATOR)
  async cancelRun(@Param('id') id: string) {
    const data = await this.runService.cancel(id);
    return { success: true, data };
  }

  // --- Quick Validation ---

  @Post('quick')
  @Roles(RoleLevel.OPERATOR)
  async quickValidate(@Body() body: {
    serverId: string;
    name?: string;
    botCount?: number;
    durationSec?: number;
  }) {
    const data = await this.quickValidation.createAndStart(body);
    return { success: true, data: data.run };
  }

  // --- Validation Verdicts ---

  @Get('runs/:id/verdict')
  @Roles(RoleLevel.VIEWER)
  async getVerdictByRunId(@Param('id') runId: string) {
    const data = await this.reportService.getVerdictByRunId(runId);
    return { success: true, data };
  }

  @Get('plans/:planId/verdicts')
  @Roles(RoleLevel.VIEWER)
  async getVerdictsByPlanId(@Param('planId') planId: string) {
    const data = await this.reportService.getVerdictsByPlanId(planId);
    return { success: true, data };
  }

  @Post('runs/:id/verdict/generate')
  @Roles(RoleLevel.OPERATOR)
  async generateVerdict(
    @Param('id') runId: string,
    @Body() body?: { thresholds?: Partial<VerdictThresholds> },
  ) {
    const thresholds: VerdictThresholds = {
      tpsMinThreshold: body?.thresholds?.tpsMinThreshold ?? 15,
      msptMaxThreshold: body?.thresholds?.msptMaxThreshold ?? 50,
      joinFailureRateMax: body?.thresholds?.joinFailureRateMax ?? 10,
      maxCriticalAlerts: body?.thresholds?.maxCriticalAlerts ?? 0,
      maxExceptions: body?.thresholds?.maxExceptions ?? 5,
    };
    const data = await this.reportService.generateVerdict(runId, thresholds);
    return { success: true, data };
  }

  // --- Observability Summary ---

  @Get('runs/:id/observability')
  @Roles(RoleLevel.VIEWER)
  async getObservabilitySummary(@Param('id') runId: string) {
    const data = await this.observabilityService.getValidationObservabilitySummary(runId);
    return { success: true, data };
  }

  // --- Session Report for Validation ---

  @Get('runs/:id/report')
  @Roles(RoleLevel.VIEWER)
  async getValidationReport(@Param('id') runId: string) {
    const data = await this.sessionReportService.generateReportForValidationRun(runId);
    return { success: true, data };
  }
}

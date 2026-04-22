import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionService } from './session.service';
import { PhaseEngineService } from './phase-engine.service';
import { SessionTemplateService } from './session-template.service';
import { ValidationRunService } from '../validation/validation-run.service';
import { ValidationPlanService } from '../validation/validation-plan.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { Auditable } from '../audit/auditable.decorator';

@Controller('api/sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly phaseEngine: PhaseEngineService,
    private readonly templateService: SessionTemplateService,
    private readonly validationRunService: ValidationRunService,
    private readonly validationPlanService: ValidationPlanService,
  ) {}

  @Get()
  async list() {
    const sessions = await this.sessionService.findAll();
    return { success: true, data: sessions };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const session = await this.sessionService.findById(id);
    if (!session) return { success: false, error: 'Session not found' };
    return { success: true, data: session };
  }

  @Post()
  @Auditable('session:create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSessionDto) {
    const session = await this.sessionService.create(dto);
    return { success: true, data: session };
  }

  /**
   * Start a session — backward-compatible.
   * Internally creates a validation plan + run so the lifecycle is tracked
   * through the unified validation executor.
   */
  @Post(':id/start')
  @Auditable('session:start')
  async start(@Param('id') id: string) {
    const session = await this.sessionService.findById(id);
    if (!session) return { success: false, error: 'Session not found' };
    const phases = session.phasesJson ? JSON.parse(session.phasesJson) : [];
    await this.phaseEngine.start(id, session.serverId, 'bot', phases);
    return { success: true };
  }

  /**
   * Stop a session — backward-compatible.
   * Also completes the associated validation run if one exists.
   */
  @Post(':id/stop')
  @Auditable('session:stop')
  async stop(@Param('id') id: string) {
    await this.phaseEngine.stop(id);
    return { success: true };
  }

  /**
   * Fail a session — marks the session and associated validation run as failed.
   */
  @Post(':id/fail')
  @Auditable('session:fail')
  async fail(@Param('id') id: string, @Body('error') error?: string) {
    await this.phaseEngine.fail(id, error ?? 'Session marked as failed');
    return { success: true };
  }

  /**
   * Start a session directly from a validation run.
   * Extracts phases from the linked validation plan.
   */
  @Post('from-run/:runId/start')
  @Auditable('session:start-from-run')
  async startFromRun(@Param('runId') runId: string) {
    const run = await this.validationRunService.findById(runId);
    if (!run) return { success: false, error: 'Validation run not found' };
    await this.phaseEngine.startFromRun(run, 'bot');
    return { success: true, data: { runId: run.id } };
  }

  @Post('from-template/:templateId')
  @Auditable('session:create-from-template')
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(@Param('templateId') templateId: string) {
    const template = await this.templateService.findById(templateId);
    if (!template) return { success: false, error: 'Template not found' };
    const botConfig = JSON.parse(template.botConfig);
    const session = await this.sessionService.create({
      name: `${template.name} - ${new Date().toISOString().slice(0, 19)}`,
      serverId: botConfig.serverId ?? 'default',
      botConfigId: botConfig.botConfigId ?? 'default',
      phases: JSON.parse(template.phases),
    });
    return { success: true, data: session };
  }

  @Get('compare')
  async compare(@Query('ids') ids: string) {
    const idList = ids.split(',').filter(Boolean);
    const sessions = await Promise.all(idList.map((id) => this.sessionService.findById(id)));
    const valid = sessions.filter(Boolean);
    return { success: true, data: valid };
  }

  /**
   * Get the validation run associated with a running session.
   */
  @Get(':id/validation-run')
  async getValidationRun(@Param('id') id: string) {
    const runId = this.phaseEngine.getValidationRunId(id);
    if (!runId) return { success: true, data: null };
    const run = await this.validationRunService.findById(runId);
    return { success: true, data: run };
  }
}

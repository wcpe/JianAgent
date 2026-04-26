import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleLevel, type LocalValidationRunDto } from '@jian-agent/shared-domain';
import { Roles } from '../auth/roles.decorator.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { LocalValidationOrchestratorService } from './local-validation-orchestrator.service.js';
import { LOCAL_VALIDATION_WORKSPACE_PREFIX } from './local-server-provisioning.service.js';
import { ScenarioCatalogService } from './scenario-catalog.service.js';
import { LocalValidationStore } from './local-validation.store.js';

interface CreateLocalValidationRunRequest {
  readonly name: string;
  readonly mode: LocalValidationRunDto['mode'];
  readonly paperVersion?: string;
  readonly scenarioPackId: string;
  readonly requestedBotCount: number;
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
}

interface AuthenticatedRequest {
  readonly user?: {
    readonly sub?: string;
    readonly username?: string;
  };
}

@Controller('local-validation')
@UseGuards(JwtGuard, RolesGuard)
export class LocalValidationController {
  constructor(
    private readonly store: LocalValidationStore,
    private readonly orchestrator: LocalValidationOrchestratorService,
    private readonly scenarios: ScenarioCatalogService,
  ) {}

  @Get('scenario-packs')
  @Roles(RoleLevel.VIEWER)
  listScenarioPacks() {
    return this.scenarios.listScenarioPacks();
  }

  @Get('runs')
  @Roles(RoleLevel.VIEWER)
  listRuns() {
    return this.store.listRuns();
  }

  @Get('runs/:id')
  @Roles(RoleLevel.VIEWER)
  async getRun(@Param('id') id: string) {
    const run = await this.store.findRunById(id);
    if (!run) {
      throw new NotFoundException(`Local validation run ${id} not found`);
    }

    return run;
  }

  @Get('runs/:id/stages')
  @Roles(RoleLevel.VIEWER)
  async listStages(@Param('id') id: string) {
    await this.getRun(id);
    return this.store.listStages(id);
  }

  @Get('runs/:id/assertions')
  @Roles(RoleLevel.VIEWER)
  async listAssertions(@Param('id') id: string) {
    await this.getRun(id);
    return this.store.listAssertions(id);
  }

  @Get('runs/:id/evidence')
  @Roles(RoleLevel.VIEWER)
  async listEvidence(@Param('id') id: string) {
    await this.getRun(id);
    return this.store.listEvidence(id);
  }

  @Post('runs')
  @Roles(RoleLevel.OPERATOR)
  async createRun(@Body() body: CreateLocalValidationRunRequest, @Req() req: AuthenticatedRequest) {
    if (body.mode !== 'init-paper') {
      throw new BadRequestException(`Local validation mode ${body.mode} is not supported yet`);
    }

    return this.store.createDraftRun({
      name: body.name,
      mode: body.mode,
      paperVersion: body.paperVersion,
      scenarioPackId: body.scenarioPackId,
      requestedBotCount: body.requestedBotCount,
      requestedBy: req.user?.username ?? req.user?.sub ?? 'unknown',
      keepServerRunning: body.keepServerRunning,
      keepWorkspace: body.keepWorkspace,
      workspacePath: await this.buildWorkspacePath(),
    });
  }

  @Post('runs/:id/start')
  @Roles(RoleLevel.OPERATOR)
  async startRun(@Param('id') id: string) {
    const run = await this.store.findRunById(id);
    if (!run) {
      throw new NotFoundException(`Local validation run ${id} not found`);
    }

    return this.orchestrator.startRun(run);
  }

  @Post('runs/:id/cancel')
  @Roles(RoleLevel.OPERATOR)
  async cancelRun(@Param('id') id: string) {
    const run = await this.store.findRunById(id);
    if (!run) {
      throw new NotFoundException(`Local validation run ${id} not found`);
    }

    if (run.status === 'CREATED') {
      return this.store.updateRunStatus(id, 'CANCELLED', { startedAt: null });
    }

    if (
      run.status === 'PASSED'
      || run.status === 'FAILED_PRECHECK'
      || run.status === 'FAILED_PROVISION'
      || run.status === 'FAILED_STARTUP'
      || run.status === 'FAILED_SCENARIO'
      || run.status === 'FAILED_RUNTIME'
      || run.status === 'CANCELLED'
      || run.status === 'FINISHED'
    ) {
      return run;
    }

    throw new ConflictException(`Local validation run ${id} cannot be cancelled from status ${run.status}`);
  }

  private async buildWorkspacePath(): Promise<string> {
    return mkdtemp(join(tmpdir(), LOCAL_VALIDATION_WORKSPACE_PREFIX));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ValidationPlanService } from './validation-plan.service.js';
import { ValidationRunService } from './validation-run.service.js';
import type {
  CreateQuickValidationInput,
  ValidationPlanDto,
  ValidationRunDto,
} from './validation.types.js';

@Injectable()
export class QuickValidationService {
  private readonly logger = new Logger(QuickValidationService.name);

  constructor(
    private readonly planService: ValidationPlanService,
    private readonly runService: ValidationRunService,
  ) {}

  async createQuickPlan(input: CreateQuickValidationInput): Promise<ValidationPlanDto> {
    const name = input.name ?? `Quick Validation ${new Date().toISOString().slice(0, 19)}`;

    const plan = await this.planService.create({
      name,
      description: 'Auto-generated quick validation plan',
      serverId: input.serverId,
      type: 'quick',
      config: {
        botCount: input.botCount ?? 1,
        durationSec: input.durationSec ?? 60,
        phases: [
          {
            name: 'warmup',
            botCount: 1,
            behavior: 'idle',
            durationSec: Math.floor((input.durationSec ?? 60) * 0.2),
          },
          {
            name: 'stress',
            botCount: input.botCount ?? 1,
            behavior: 'random_walk',
            durationSec: Math.floor((input.durationSec ?? 60) * 0.6),
          },
          {
            name: 'cooldown',
            botCount: 1,
            behavior: 'idle',
            durationSec: Math.floor((input.durationSec ?? 60) * 0.2),
          },
        ],
      },
    });

    this.logger.log(`Created quick validation plan ${plan.id} for server ${input.serverId}`);
    return plan;
  }

  async createAndStart(input: CreateQuickValidationInput): Promise<{
    plan: ValidationPlanDto;
    run: ValidationRunDto;
  }> {
    const plan = await this.createQuickPlan(input);
    const run = await this.runService.create(plan.id, input.serverId);
    const startedRun = await this.runService.start(run.id);

    this.logger.log(`Quick validation started: plan=${plan.id}, run=${run.id}`);
    return { plan, run: startedRun };
  }

  async getQuickPlansForServer(serverId: string): Promise<ValidationPlanDto[]> {
    const plans = await this.planService.findByServerId(serverId);
    return plans.filter((p) => p.type === 'quick');
  }

  async getLatestQuickRun(serverId: string): Promise<ValidationRunDto | null> {
    const plans = await this.getQuickPlansForServer(serverId);
    if (plans.length === 0) return null;

    const planIds = new Set(plans.map((p) => p.id));
    const runs = await this.runService.findByServerId(serverId);
    const quickRuns = runs.filter((r: ValidationRunDto) => planIds.has(r.planId));

    if (quickRuns.length === 0) return null;

    quickRuns.sort((a: ValidationRunDto, b: ValidationRunDto) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return quickRuns[0];
  }
}
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/jwt.guard.js';
import { PolicyEngineService } from './policy-engine.service.js';

@Controller('api/control-plane/policies')
@UseGuards(JwtGuard)
export class PolicyController {
  constructor(private readonly policyEngineService: PolicyEngineService) {}

  @Get('cpu-fullgc')
  getRule() {
    return this.policyEngineService.getRule();
  }

  @Post('cpu-fullgc')
  updateRule(
    @Body()
    body: {
      cpuThreshold?: number;
      fullGcThreshold?: number;
      action?: 'restart' | 'scale';
    },
  ) {
    return this.policyEngineService.updateRule(body);
  }

  @Post('evaluate')
  evaluate(
    @Body() body: { tenantId: string; target: string; cpu: number; fullGcCount: number },
  ) {
    return this.policyEngineService.evaluateAndTrigger(body);
  }
}

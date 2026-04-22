import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/jwt.guard.js';
import { TenantScopeGuard } from '../../common/tenant-scope.guard.js';
import { AgentGatewayService } from './agent-gateway.service.js';

@Controller('api/control-plane/agents')
@UseGuards(JwtGuard, TenantScopeGuard)
export class AgentController {
  constructor(private readonly agentGatewayService: AgentGatewayService) {}

  @Post('register')
  register(
    @Body() body: { id: string; hostId: string; capabilities?: string[] },
  ) {
    return this.agentGatewayService.register({
      id: body.id,
      hostId: body.hostId,
      capabilities: body.capabilities ?? [],
    });
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string) {
    return this.agentGatewayService.heartbeat(id);
  }

  @Get()
  list() {
    return this.agentGatewayService.list();
  }
}

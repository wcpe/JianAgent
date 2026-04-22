import { Module, forwardRef } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { AgentController } from './agent/agent.controller.js';
import { AgentGatewayService } from './agent/agent-gateway.service.js';
import { OperationJobService } from './orchestrator/operation-job.service.js';
import { ApprovalService } from './approval/approval.service.js';
import { PolicyEngineService } from './policy/policy-engine.service.js';
import { OperationJobController } from './orchestrator/operation-job.controller.js';
import { PolicyController } from './policy/policy.controller.js';
import { GovernanceModule } from './governance/governance.module.js';

@Module({
  imports: [forwardRef(() => GovernanceModule)],
  controllers: [
    CatalogController,
    AgentController,
    OperationJobController,
    PolicyController,
  ],
  providers: [
    CatalogService,
    AgentGatewayService,
    OperationJobService,
    ApprovalService,
    PolicyEngineService,
  ],
  exports: [
    CatalogService,
    AgentGatewayService,
    OperationJobService,
    ApprovalService,
    PolicyEngineService,
  ],
})
export class ControlPlaneModule {}

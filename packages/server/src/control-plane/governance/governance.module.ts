import { Module, forwardRef } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';
import { GovernanceVerdictResolver } from './governance-verdict.resolver.js';
import { ControlPlaneModule } from '../control-plane.module.js';

@Module({
  imports: [forwardRef(() => ControlPlaneModule)],
  providers: [GovernanceService, GovernanceVerdictResolver],
  exports: [GovernanceService, GovernanceVerdictResolver],
})
export class GovernanceModule {}

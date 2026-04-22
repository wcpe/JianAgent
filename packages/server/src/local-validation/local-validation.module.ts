import { Module, forwardRef } from '@nestjs/common';
import { BotModule } from '../bot/bot.module.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { PaperReleaseService } from './paper-release.service.js';
import { LocalServerProvisioningService } from './local-server-provisioning.service.js';
import { LocalValidationController } from './local-validation.controller.js';
import { LocalValidationMapper } from './local-validation.mapper.js';
import { LocalValidationOrchestratorService } from './local-validation-orchestrator.service.js';
import { LocalValidationScenarioService } from './local-validation-scenario.service.js';
import { ScenarioAssertionService } from './scenario-assertion.service.js';
import { ScenarioCatalogService } from './scenario-catalog.service.js';
import { LocalValidationStore } from './local-validation.store.js';
import { ValidationEvidenceService } from './validation-evidence.service.js';
import { ValidationReportService } from './validation-report.service.js';

@Module({
  imports: [forwardRef(() => ServerProcessModule), BotModule],
  controllers: [LocalValidationController],
  providers: [
    LocalValidationMapper,
    LocalValidationStore,
    ScenarioCatalogService,
    ScenarioAssertionService,
    PaperReleaseService,
    LocalServerProvisioningService,
    ValidationEvidenceService,
    ValidationReportService,
    LocalValidationScenarioService,
    LocalValidationOrchestratorService,
  ],
  exports: [LocalValidationStore, LocalValidationOrchestratorService, ScenarioCatalogService, ScenarioAssertionService],
})
export class LocalValidationModule {}

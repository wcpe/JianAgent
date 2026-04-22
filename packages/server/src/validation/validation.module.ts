import { Module } from '@nestjs/common';
import { ValidationPlanService } from './validation-plan.service.js';
import { ValidationRunService } from './validation-run.service.js';
import { ValidationRunMapper } from './validation-run.mapper.js';
import { QuickValidationService } from './quick-validation.service.js';
import { ValidationReportService } from './validation-report.service.js';
import { ValidationController } from './validation.controller.js';
import { PlatformObservabilityModule } from '../platform-observability/platform-observability.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';

@Module({
  imports: [PlatformObservabilityModule, MetricsModule],
  controllers: [ValidationController],
  providers: [
    ValidationPlanService,
    ValidationRunService,
    ValidationRunMapper,
    QuickValidationService,
    ValidationReportService,
  ],
  exports: [
    ValidationPlanService,
    ValidationRunService,
    QuickValidationService,
    ValidationReportService,
  ],
})
export class ValidationModule {}
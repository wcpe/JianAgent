import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { PhaseEngineService } from './phase-engine.service';
import { SessionController } from './session.controller';
import { SessionTemplateService } from './session-template.service';
import { SessionTemplateController } from './session-template.controller';
import { StartTemplateService } from './start-template.service.js';
import { StartTemplateController } from './start-template.controller.js';
import { PhaseConditionService } from './phase-condition.service.js';
import { PhaseSummaryService } from './phase-summary.service.js';
import { BotModule } from '../bot/bot.module';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [BotModule, ValidationModule],
  controllers: [SessionController, SessionTemplateController, StartTemplateController],
  providers: [SessionService, PhaseEngineService, SessionTemplateService, StartTemplateService, PhaseConditionService, PhaseSummaryService],
  exports: [SessionService, PhaseEngineService, SessionTemplateService, StartTemplateService, PhaseConditionService, PhaseSummaryService],
})
export class SessionModule {}

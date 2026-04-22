import { Module, forwardRef } from '@nestjs/common';
import { WorkerPoolService } from './worker-pool.service';
import { BotOrchestratorService } from './bot-orchestrator.service';
import { BotStateService } from './bot-state.service';
import { BotRealtimeService } from './bot-realtime.service.js';
import { BotController } from './bot.controller';
import { BotGroupService } from './bot-group.service.js';
import { BotGroupController } from './bot-group.controller.js';
import { BehaviorTemplateService } from './behavior-template.service.js';
import { BehaviorTemplateController } from './behavior-template.controller.js';
import { WorkerRegistryService } from './worker-registry.service.js';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerController } from './worker.controller.js';
import { SavedBotConfigService } from './saved-bot-config.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';

@Module({
  imports: [RealtimeModule, forwardRef(() => ServerProcessModule)],
  controllers: [BotController, BotGroupController, BehaviorTemplateController, WorkerController],
  providers: [
    WorkerPoolService,
    BotOrchestratorService,
    BotStateService,
    BotRealtimeService,
    BotGroupService,
    BehaviorTemplateService,
    WorkerRegistryService,
    WorkerHealthService,
    SavedBotConfigService,
  ],
  exports: [BotOrchestratorService, BotStateService, WorkerPoolService, BotRealtimeService, WorkerRegistryService],
})
export class BotModule {}

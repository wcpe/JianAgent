import { Module, forwardRef } from '@nestjs/common';
import { LogFileController } from './log-file.controller.js';
import { LogQueryController } from './log-query.controller.js';
import { LogSearchController } from './log-search.controller.js';
import { LogAnalyticsController } from './log-analytics.controller.js';
import { LogFileService } from './log-file.service.js';
import { LogSearchService } from './log-search.service.js';
import {
  LOG_QUERY_STRATEGY_OPTIONS,
  LocalFileLogQueryBackend,
  LokiLogQueryBackend,
  LogQueryStrategyService,
} from './log-query-strategy.service.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';

@Module({
  imports: [forwardRef(() => ServerProcessModule)],
  controllers: [LogFileController, LogQueryController, LogSearchController, LogAnalyticsController],
  providers: [
    LogFileService,
    LogSearchService,
    LocalFileLogQueryBackend,
    LokiLogQueryBackend,
    {
      provide: LOG_QUERY_STRATEGY_OPTIONS,
      useValue: {},
    },
    LogQueryStrategyService,
  ],
  exports: [LogFileService, LogSearchService, LogQueryStrategyService],
})
export class LogFileModule {}

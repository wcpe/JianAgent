import { Module, Global } from '@nestjs/common';
import { DrizzleProvider, DRIZZLE_TOKEN } from './drizzle.provider.js';
import { ConfigStoreService } from './config-store.service.js';
import { AuditStoreService } from './audit-store.service.js';
import { MetricStoreService } from './metric-store.service.js';
import { ArchiverService } from './archiver.service.js';

@Global()
@Module({
  providers: [
    DrizzleProvider,
    {
      provide: DRIZZLE_TOKEN,
      useFactory: (provider: DrizzleProvider) => provider.db,
      inject: [DrizzleProvider],
    },
    ConfigStoreService,
    AuditStoreService,
    MetricStoreService,
    ArchiverService,
  ],
  exports: [DRIZZLE_TOKEN, DrizzleProvider, ConfigStoreService, AuditStoreService, MetricStoreService, ArchiverService],
})
export class StorageModule {}

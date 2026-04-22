import { Module } from '@nestjs/common';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';
import { JvmCapabilityModule } from '../jvm-capability/jvm-capability.module.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { PlatformResourceModule } from '../platform-resource/platform-resource.module.js';
import { JvmDiagnosticsService } from './jvm-diagnostics.service.js';
import { MinecraftOpsService } from './minecraft-ops.service.js';
import { SpecializedContextMapper } from './specialized-context.mapper.js';

@Module({
  imports: [
    JavaHelperModule,
    JvmCapabilityModule,
    ServerProcessModule,
    MetricsModule,
    StorageModule,
    PlatformResourceModule,
  ],
  providers: [
    JvmDiagnosticsService,
    MinecraftOpsService,
    SpecializedContextMapper,
  ],
  exports: [
    JvmDiagnosticsService,
    MinecraftOpsService,
  ],
})
export class PlatformSpecializedModule {}

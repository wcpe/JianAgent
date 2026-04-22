import { Module, forwardRef } from '@nestjs/common';
import { ServerConfigService } from './server-config.service.js';
import { ProcessManagerService } from './process-manager.service.js';
import { ProcessMonitorService } from './process-monitor.service.js';
import { ProcessAttachService } from './process-attach.service.js';
import { ScheduledStopService } from './scheduled-stop.service.js';
import { ConditionalStopService } from './conditional-stop.service.js';
import { CrashRestartService } from './crash-restart.service.js';
import { HealthMonitorService } from './health-monitor.service.js';
import { ProcessOrchestratorService } from './process-orchestrator.service.js';
import { StartTemplateService } from './start-template.service.js';
import { MultiServerService } from './multi-server.service.js';
import { LogPersistService } from './log-persist.service.js';
import { ProbeInjectorService } from './probe-injector.service.js';
import { McPingService } from './mc-ping.service.js';
import { ProcessResourceMonitor } from './monitor/process-resource-monitor.service.js';
import { ProcessMetricsStore } from './monitor/process-metrics.store.js';
import { ConfigSnapshotService } from './snapshot/config-snapshot.service.js';
import { PopulationTrackerService } from './population-tracker.service.js';
import { ServersController } from './servers.controller.js';
import { ServerLifecycleEngine } from './lifecycle/lifecycle-engine.service.js';
import { StartValidatorService } from './lifecycle/start-validator.service.js';
import { ShellHookExecutor } from './lifecycle/shell-hook-executor.service.js';
import { StartReadyDetector } from './lifecycle/start-ready-detector.service.js';
import { PopulationController } from './population.controller.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { PluginBridgeModule } from '../plugin-bridge/plugin-bridge.module.js';
import { PtyAuditService } from '../pty/pty-audit.service.js';
import { SshModule } from '../ssh/ssh.module.js';
import { PlatformResourceModule } from '../platform-resource/platform-resource.module.js';
import { JavaRuntimeModule } from '../java-runtime/java-runtime.module.js';
import { JavaHelperModule } from '../java-helper/java-helper.module.js';

@Module({
  imports: [MetricsModule, SshModule, PluginBridgeModule, forwardRef(() => PlatformResourceModule), JavaRuntimeModule, JavaHelperModule],
  controllers: [ServersController, PopulationController],
  providers: [
    ServerConfigService,
    ProcessManagerService,
    ProcessMonitorService,
    ProcessAttachService,
    ScheduledStopService,
    ConditionalStopService,
    CrashRestartService,
    HealthMonitorService,
    ProcessOrchestratorService,
    StartTemplateService,
    MultiServerService,
    LogPersistService,
    ProbeInjectorService,
    McPingService,
    PopulationTrackerService,
    ProcessResourceMonitor,
    ProcessMetricsStore,
    ConfigSnapshotService,
    PtyAuditService,
    ServerLifecycleEngine,
    StartValidatorService,
    ShellHookExecutor,
    StartReadyDetector,
  ],
  exports: [ProcessManagerService, ProcessMonitorService, ServerConfigService, ScheduledStopService, HealthMonitorService, MultiServerService, ProcessAttachService, PopulationTrackerService, ConditionalStopService, CrashRestartService, StartTemplateService, ServerLifecycleEngine, ProcessResourceMonitor, ConfigSnapshotService],
})
export class ServerProcessModule {}

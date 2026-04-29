import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuditInterceptor } from './audit/audit.interceptor.js';
import { EventBusModule } from './event-bus/event-bus.module.js';
import { ServerProcessModule } from './server-process/server-process.module.js';
import { ServerEventModule } from './server-event/server-event.module.js';
import { PtyModule } from './pty/pty.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { BotModule } from './bot/bot.module.js';
import { SessionModule } from './session/session.module.js';
import { PluginBridgeModule } from './plugin-bridge/plugin-bridge.module.js';
import { JavaHelperModule } from './java-helper/java-helper.module.js';
import { JvmModule } from './jvm/jvm.module.js';
import { SshModule } from './ssh/ssh.module.js';
import { FileManagerModule } from './file-manager/file-manager.module.js';
import { PluginManagerModule } from './plugin-manager/plugin-manager.module.js';
import { LogFileModule } from './log-file/log-file.module.js';
import { BackupModule } from './backup/backup.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { ControlPlaneModule } from './control-plane/control-plane.module.js';
import { RemoteHostModule } from './remote-host/remote-host.module.js';
import { LogCollectorModule } from './log-collector/log-collector.module.js';
import { PlatformModelModule } from './platform-model/platform-model.module.js';
import { TerminalSessionModule } from './terminal-session/terminal-session.module.js';
import { PlatformResourceModule } from './platform-resource/platform-resource.module.js';
import { JavaRuntimeModule } from './java-runtime/java-runtime.module.js';
import { PlatformSpecializedModule } from './platform-specialized/platform-specialized.module.js';
import { ValidationModule } from './validation/validation.module.js';
import { LocalValidationModule } from './local-validation/local-validation.module.js';
import { PlatformRuntimeModule } from './platform-runtime/platform-runtime.module.js';
import { HealthModule } from './health/health.module.js';
import { PortModule } from './port/port.module.js';
import { MonitoringModule } from './monitoring/monitoring.module.js';
import { ArthasAdapterModule } from './arthas-adapter/arthas-adapter.module.js';
import { RequestContextInterceptor } from './common/request-context.interceptor.js';
import { ApiResponseInterceptor } from './common/api-response.interceptor.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { CsrfGuard } from './common/csrf.guard.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 60 }] }),
    EventBusModule,
    StorageModule,
    AuthModule,
    AuditModule,
    ServerProcessModule,
    ServerEventModule,
    PtyModule,
    RealtimeModule,
    MetricsModule,
    BotModule,
    SessionModule,
    PluginBridgeModule,
    JavaHelperModule,
    JvmModule,
    SshModule,
    FileManagerModule,
    PluginManagerModule,
    LogFileModule,
    BackupModule,
    NotificationModule,
    ControlPlaneModule,
    RemoteHostModule,
    LogCollectorModule,
    PlatformModelModule,
    TerminalSessionModule,
    PlatformResourceModule,
    JavaRuntimeModule,
    PlatformSpecializedModule,
    ValidationModule,
    LocalValidationModule,
    PlatformRuntimeModule,
    HealthModule,
    PortModule,
    MonitoringModule,
    ArthasAdapterModule,
  ],
  providers: [
    RequestContextInterceptor,
    ApiResponseInterceptor,
    ApiExceptionFilter,
    AuditInterceptor,
    CsrfGuard,
    {
      provide: APP_GUARD,
      useExisting: CsrfGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useExisting: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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

@Module({
  imports: [
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
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { PluginManagerController } from './plugin-manager.controller.js';
import { PluginManagerService } from './plugin-manager.service.js';
import { PluginOperationService } from './plugin-operation.service.js';
import { PluginRuntimeService } from './plugin-runtime.service.js';
import { JarPluginScanner } from './scanners/jar-plugin-scanner.js';
import { PluginStateResolver } from './plugin-state-resolver.js';
import { PluginConfigDiscoveryService } from './plugin-config-discovery.service.js';
import { FileManagerModule } from '../file-manager/file-manager.module.js';
import { PluginBridgeModule } from '../plugin-bridge/plugin-bridge.module.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';

@Module({
  imports: [FileManagerModule, PluginBridgeModule, ServerProcessModule],
  controllers: [PluginManagerController],
  providers: [
    PluginManagerService,
    PluginOperationService,
    PluginRuntimeService,
    JarPluginScanner,
    PluginStateResolver,
    PluginConfigDiscoveryService,
  ],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}

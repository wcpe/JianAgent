import { Module } from '@nestjs/common';
import { PluginBridgeGateway } from './plugin-bridge.gateway.js';
import { PluginBridgeService } from './plugin-bridge.service.js';
import { HandshakeService } from './handshake.service.js';
import { SnapshotService } from './snapshot.service.js';
import { PluginBridgeController } from './plugin-bridge.controller.js';
import { WhitelistActionService } from './whitelist-action.service.js';
import { WhitelistActionController } from './whitelist-action.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  controllers: [PluginBridgeController, WhitelistActionController],
  providers: [
    PluginBridgeGateway,
    PluginBridgeService,
    HandshakeService,
    SnapshotService,
    WhitelistActionService,
  ],
  exports: [PluginBridgeService, SnapshotService, WhitelistActionService],
})
export class PluginBridgeModule {}

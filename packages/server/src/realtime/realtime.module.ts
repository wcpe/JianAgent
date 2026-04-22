import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import { NodeLogBridgeService } from './node-log-bridge.service.js';
import { NodeLogController } from './node-log.controller.js';
import { LogFileModule } from '../log-file/log-file.module.js';

@Global()
@Module({
  imports: [LogFileModule],
  controllers: [NodeLogController],
  providers: [RealtimeGateway, NodeLogBridgeService],
  exports: [RealtimeGateway, NodeLogBridgeService],
})
export class RealtimeModule {}

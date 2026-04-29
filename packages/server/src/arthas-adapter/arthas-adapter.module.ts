import { Module } from '@nestjs/common';
import { ArthasService } from './arthas.service.js';
import { ArthasController } from './arthas.controller.js';
import { ArthasGateway } from './arthas.gateway.js';

@Module({
  controllers: [ArthasController],
  providers: [ArthasService, ArthasGateway],
  exports: [ArthasService],
})
export class ArthasAdapterModule {}

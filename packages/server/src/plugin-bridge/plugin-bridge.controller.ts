import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PluginBridgeService } from './plugin-bridge.service.js';
import { SnapshotService } from './snapshot.service.js';

interface SendCommandBody {
  readonly action: string;
  readonly params: Record<string, unknown>;
}

interface ExecuteConsoleBody {
  readonly command: string;
}

interface EvalScriptBody {
  readonly script: string;
}

@Controller('api/plugin-bridge')
export class PluginBridgeController {
  constructor(
    private readonly bridgeService: PluginBridgeService,
    private readonly snapshotService: SnapshotService,
  ) {}

  @Get('connections')
  listConnections() {
    return this.bridgeService.getAllConnections().map((c) => ({
      id: c.id,
      serverId: c.serverId,
      connectedAt: c.connectedAt.toISOString(),
      protocolVersion: c.protocolVersion,
      runtimeKind: c.runtimeKind ?? null,
      capabilityMatrix: c.capabilityMatrix ?? [],
    }));
  }

  @Get('snapshot/:serverId')
  getSnapshot(@Param('serverId') serverId: string) {
    const stored = this.snapshotService.getLatest(serverId);
    if (!stored) {
      throw new HttpException('No snapshot available', HttpStatus.NOT_FOUND);
    }
    return {
      serverId: stored.serverId,
      snapshot: stored.snapshot,
      receivedAt: stored.receivedAt.toISOString(),
    };
  }

  @Get('snapshots')
  getAllSnapshots() {
    return this.snapshotService.getAllLatest().map((s) => ({
      serverId: s.serverId,
      snapshot: s.snapshot,
      receivedAt: s.receivedAt.toISOString(),
    }));
  }

  @Post('command/:serverId')
  sendCommand(
    @Param('serverId') serverId: string,
    @Body() body: SendCommandBody,
  ) {
    if (!body.action) {
      throw new HttpException('Missing action', HttpStatus.BAD_REQUEST);
    }
    const requestId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sent = this.bridgeService.sendCommand(serverId, body.action, body.params ?? {}, requestId);
    if (!sent) {
      throw new HttpException('Plugin not connected', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { requestId, sent: true };
  }

  @Post('console/:serverId')
  executeConsole(
    @Param('serverId') serverId: string,
    @Body() body: ExecuteConsoleBody,
  ) {
    if (!body.command) {
      throw new HttpException('Missing command', HttpStatus.BAD_REQUEST);
    }
    const requestId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sent = this.bridgeService.sendConsoleCommand(serverId, body.command, requestId);
    if (!sent) {
      throw new HttpException('Plugin not connected', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { requestId, sent: true };
  }

  @Post('eval/:serverId')
  evalScript(
    @Param('serverId') serverId: string,
    @Body() body: EvalScriptBody,
  ) {
    if (!body.script) {
      throw new HttpException('Missing script', HttpStatus.BAD_REQUEST);
    }
    const requestId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sent = this.bridgeService.sendEvalScript(serverId, body.script, requestId);
    if (!sent) {
      throw new HttpException('Plugin not connected', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { requestId, sent: true };
  }
}

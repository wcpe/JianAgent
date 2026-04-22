import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProcessManagerService } from './process-manager.service.js';
import { ServerConfigService } from './server-config.service.js';
import { MultiServerService } from './multi-server.service.js';
import { ScheduledStopService } from './scheduled-stop.service.js';
import { ConditionalStopService, type StopCondition } from './conditional-stop.service.js';
import { CrashRestartService } from './crash-restart.service.js';
import { HealthMonitorService } from './health-monitor.service.js';
import { StartTemplateService } from './start-template.service.js';
import { LogStoreService } from '../metrics/log-store.service.js';
import { PtyAuditService } from '../pty/pty-audit.service.js';
import { SshTerminalService } from '../ssh/ssh-terminal.service.js';
import { SshPoolService } from '../ssh/ssh-pool.service.js';
import { SshCryptoService } from '../ssh/ssh-crypto.service.js';
import { PlatformResourceService } from '../platform-resource/platform-resource.service.js';
import { JvmCapabilityFacade } from '../java-helper/jvm-capability.facade.js';
import { ServerLifecycleEngine } from './lifecycle/lifecycle-engine.service.js';
import { StartValidatorService } from './lifecycle/start-validator.service.js';
import { ProcessResourceMonitor } from './monitor/process-resource-monitor.service.js';
import { ProcessMetricsStore } from './monitor/process-metrics.store.js';
import { ConfigSnapshotService } from './snapshot/config-snapshot.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import { RoleLevel, ServerState } from '@jian-agent/shared-domain';
import type {
  CreateServerConfigRequest,
  UpdateServerConfigRequest,
  ServerWithStatusDto,
  ConditionalStopDto,
  CreateStartTemplateDto,
  UpdateStartTemplateDto,
} from '@jian-agent/shared-domain';

@Controller('api/servers')
@UseGuards(JwtGuard, RolesGuard)
export class ServersController {
  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly configService: ServerConfigService,
    private readonly multiServer: MultiServerService,
    private readonly jvmFacade: JvmCapabilityFacade,
    private readonly scheduledStop: ScheduledStopService,
    private readonly conditionalStop: ConditionalStopService,
    private readonly crashRestart: CrashRestartService,
    private readonly healthMonitor: HealthMonitorService,
    private readonly startTemplateService: StartTemplateService,
    private readonly logStore: LogStoreService,
    private readonly auditService: PtyAuditService,
    private readonly sshTerminal: SshTerminalService,
    private readonly sshPool: SshPoolService,
    private readonly sshCrypto: SshCryptoService,
    private readonly platformResourceService: PlatformResourceService,
    private readonly lifecycleEngine: ServerLifecycleEngine,
    private readonly validator: StartValidatorService,
    private readonly processResourceMonitor: ProcessResourceMonitor,
    private readonly metricsStore: ProcessMetricsStore,
    private readonly configSnapshotService: ConfigSnapshotService,
  ) {}

  // ── Config + Status CRUD ──

  @Get()
  @Roles(RoleLevel.VIEWER)
  async listServers(): Promise<readonly ServerWithStatusDto[]> {
    return this.multiServer.listServers();
  }

  // ── List running Java processes (must be before :id) ──

  @Get('java-processes')
  @Roles(RoleLevel.VIEWER)
  async listJavaProcesses() {
    const { execSync } = await import('node:child_process');
    try {
      const isWin = process.platform === 'win32';
      const cmd = isWin
        ? 'wmic process where "name like \'%java%\'" get processid,commandline /format:csv'
        : "ps aux | grep java | grep -v grep";
      const output = execSync(cmd, { timeout: 5000 }).toString();
      const processes: Array<{ pid: number; command: string }> = [];

      if (isWin) {
        for (const line of output.split('\n')) {
          const parts = line.trim().split(',');
          if (parts.length >= 3) {
            const pid = parseInt(parts[parts.length - 1]!, 10);
            const command = parts.slice(1, -1).join(',');
            if (!isNaN(pid) && pid > 0) processes.push({ pid, command });
          }
        }
      } else {
        for (const line of output.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const pid = parseInt(parts[1]!, 10);
            const command = parts.slice(10).join(' ');
            if (!isNaN(pid)) processes.push({ pid, command });
          }
        }
      }

      return { success: true, data: processes };
    } catch {
      return { success: true, data: [] };
    }
  }

  @Post(':id/validate')
  @Roles(RoleLevel.VIEWER)
  async validateServer(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    return this.validator.validate(config);
  }

  @Get(':id/validate')
  @Roles(RoleLevel.VIEWER)
  async getLastValidation(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    return this.validator.validate(config);
  }

  @Get(':id/config')
  @Roles(RoleLevel.VIEWER)
  async getServerConfig(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    // Mask password fields for security
    return {
      ...config,
      sshPassword: config.sshPassword ? '***' : '',
      sshPassphrase: config.sshPassphrase ? '***' : '',
    };
  }

  // ── Start Templates ──
  // Note: Most template endpoints have been moved to StartTemplateController
  // These are kept for backward compatibility if needed, but should be removed
  // in a future major version.

  @Post('batch')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.batch')
  async batchOperation(@Body() body: {
    action: 'start' | 'stop' | 'restart' | 'delete';
    serverIds: string[];
    stopMode?: 'graceful' | 'force';
  }) {
    if (!body.serverIds?.length) throw new BadRequestException('serverIds is required');
    const results: Array<{ serverId: string; success: boolean; error?: string }> = [];

    for (const serverId of body.serverIds) {
      try {
        switch (body.action) {
          case 'start': {
            const config = await this.configService.getById(serverId);
            if (!config) throw new Error('Config not found');
            await this.lifecycleEngine.start(serverId, config);
            break;
          }
          case 'stop':
            await this.lifecycleEngine.stop(serverId, body.stopMode === 'force');
            break;
          case 'restart':
            await this.lifecycleEngine.restart(serverId);
            break;
          case 'delete':
            await this.deleteServer(serverId);
            break;
          default:
            throw new Error(`Unknown action: ${body.action}`);
        }
        results.push({ serverId, success: true });
      } catch (err: any) {
        results.push({ serverId, success: false, error: err.message });
      }
    }

    return { results };
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  async getServer(@Param('id') id: string) {
    return this.platformResourceService.getDetailById(id);
  }

  @Post()
  @Roles(RoleLevel.DANGER)
  @Auditable('server.create')
  async createServer(@Body() body: CreateServerConfigRequest) {
    return this.configService.create(body);
  }

  @Post('preflight-preview')
  @Roles(RoleLevel.VIEWER)
  async preflightPreview(
    @Body() body: Partial<CreateServerConfigRequest> & { name?: string },
  ) {
    return this.validator.validate({
      id: 'preview',
      name: body.name ?? 'preview',
      serverType: body.serverType ?? 'managed',
      javaPath: body.javaPath ?? 'java',
      jarPath: body.jarPath ?? '',
      workDir: body.workDir ?? '',
      jvmArgs: body.jvmArgs ?? [],
      serverArgs: body.serverArgs ?? [],
      envVars: body.envVars ?? {},
      encoding: body.encoding ?? 'utf-8',
      autoRestart: body.autoRestart ?? false,
      maxRestarts: body.maxRestarts ?? 0,
      host: body.host ?? '127.0.0.1',
      port: body.port ?? 25565,
      sshHost: body.sshHost ?? '',
      sshPort: body.sshPort ?? 22,
      sshUsername: body.sshUsername ?? '',
      sshAuthType: body.sshAuthType ?? 'password',
      sshPassword: body.sshPassword ?? '',
      sshKeyPath: body.sshKeyPath ?? '',
      sshPassphrase: body.sshPassphrase ?? '',
      serverDir: body.serverDir ?? '',
      logsPath: body.logsPath ?? '',
      runtimeId: body.runtimeId ?? '',
      probeVersion: '',
      preStartCommand: body.preStartCommand ?? '',
      postStartCommand: body.postStartCommand ?? '',
      preStopCommand: body.preStopCommand ?? '',
      postStopCommand: body.postStopCommand ?? '',
      scriptTimeoutMs: body.scriptTimeoutMs ?? 30_000,
      readyPattern: body.readyPattern ?? '',
      readyTimeoutMs: body.readyTimeoutMs ?? 30_000,
      serverGroup: body.serverGroup ?? '',
      tags: body.tags ?? [],
      description: body.description ?? '',
      createdAt: '',
      updatedAt: '',
    });
  }

  @Put(':id')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.update')
  async updateServer(
    @Param('id') id: string,
    @Body() body: UpdateServerConfigRequest,
  ) {
    // Auto-snapshot old config before updating
    const oldConfig = await this.configService.getById(id);
    if (oldConfig) {
      await this.configSnapshotService.create(id, oldConfig);
    }
    return this.configService.update(id, body);
  }

  @Delete(':id')
  @Roles(RoleLevel.ADMIN)
  @Auditable('server.delete')
  async deleteServer(@Param('id') id: string) {
    const server = await this.multiServer.getServer(id);
    if (!server) throw new NotFoundException(`Server ${id} not found`);
    if (server.serverType !== 'external') {
      const state = this.processManager.getState(id);
      if (state === ServerState.RUNNING || state === ServerState.STARTING || state === ServerState.STOPPING) {
        throw new BadRequestException(`Cannot delete server ${id}: currently ${state}. Stop it first.`);
      }
    }
    return this.configService.delete(id);
  }

  // ── Lifecycle operations ──

  @Post(':id/start')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.start')
  async startServer(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    await this.lifecycleEngine.start(id, config);
    return { success: true, pid: this.processManager.getStatus(id).pid };
  }

  @Post(':id/stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.stop')
  async stopServer(@Param('id') id: string) {
    await this.lifecycleEngine.stop(id, false);
    return { success: true };
  }

  @Post(':id/interrupt')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.interrupt')
  async interruptServer(@Param('id') id: string) {
    await this.lifecycleEngine.stop(id, true);
    return { success: true };
  }

  @Post(':id/restart')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.restart')
  async restartServer(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    await this.lifecycleEngine.restart(id);
    return { success: true };
  }

  @Get(':id/output')
  @Roles(RoleLevel.VIEWER)
  getServerOutput(@Param('id') id: string) {
    const lines = this.processManager.getOutputBuffer(id);
    return { serverId: id, lines };
  }

  // ── Server log replay ──

  @Get(':id/logs')
  @Roles(RoleLevel.VIEWER)
  async getServerLogs(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('stream') stream?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));

    const result = await this.logStore.query({
      hosts: [id],
      startTime: from || undefined,
      endTime: to || undefined,
      q: search || undefined,
      source: stream === 'stderr' ? 'SERVER_PROCESS' : undefined,
      level: stream === 'stderr' ? 'ERROR' : undefined,
      page,
      limit,
    });

    const items = result.entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      stream: e.level === 'ERROR' ? 'stderr' : 'stdout',
      content: e.content,
      level: e.level,
    }));

    return { items, total: result.total };
  }

  // ── Command audit ──

  @Get(':id/audit')
  @Roles(RoleLevel.VIEWER)
  async getServerAudit(
    @Param('id') id: string,
    @Query('from') _from?: string,
    @Query('to') _to?: string,
    @Query('q') searchQuery?: string,
    @Query('result') resultFilter?: string,
    @Query('danger') dangerFilter?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));
    const offset = (page - 1) * limit;

    const entries = await this.auditService.getAuditEntries({
      serverId: id,
      limit,
      offset,
    });

    let items = entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      username: e.username,
      command: e.command,
      result: e.allowed ? 'sent' as const : 'blocked' as const,
      isDanger: !e.allowed,
    }));

    // Client-side filtering (backend getAuditEntries doesn't support these yet)
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      items = items.filter((i) => i.command.toLowerCase().includes(lower) || (i.username ?? '').toLowerCase().includes(lower));
    }
    if (resultFilter && resultFilter !== 'all') {
      items = items.filter((i) => i.result === resultFilter);
    }
    if (dangerFilter === 'true') {
      items = items.filter((i) => i.isDanger);
    }

    return { items, total: items.length < limit ? offset + items.length : offset + limit + 1 };
  }

  // ── External server ping ──

  @Post(':id/ping')
  @Roles(RoleLevel.VIEWER)
  async pingServer(@Param('id') id: string) {
    const result = await this.multiServer.pingExternal(id);
    if (!result) throw new BadRequestException(`Server ${id} is not an external server`);
    return { success: true, data: result };
  }

  // ── Attach external JDK process ──

  @Post(':id/attach')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.attach')
  async attachProcess(@Param('id') id: string, @Body() body: { pid: number }) {
    if (!body.pid || typeof body.pid !== 'number') {
      throw new BadRequestException('PID is required');
    }
    const result = await this.jvmFacade.attachProcess(id, body.pid);
    if (!result.success) throw new BadRequestException(`Failed to attach PID ${body.pid}`);
    return { success: true, state: result.state };
  }

  @Post(':id/detach')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.detach')
  detachProcess(@Param('id') id: string) {
    this.jvmFacade.detachProcess(id);
    return { success: true };
  }

  // ── SSH terminal ──

  @Post(':id/ssh/connect')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.ssh.connect')
  async sshConnect(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    if (!config.sshHost) throw new BadRequestException('SSH host not configured for this server');
    const sessionId = `ssh-${id}-${Date.now()}`;
    const sshConfig = this.configService.serverConfigToSshConfig(config);
    await this.sshTerminal.createSession(sshConfig, sessionId);
    return { success: true, sessionId };
  }

  @Delete(':id/ssh/disconnect')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.ssh.disconnect')
  sshDisconnect(@Param('id') id: string, @Query('sessionId') sessionId?: string) {
    if (sessionId) {
      this.sshTerminal.closeSession(sessionId);
    } else {
      this.sshTerminal.closeAllForServer(id);
    }
    return { success: true };
  }

  @Post(':id/ssh/test')
  @Roles(RoleLevel.DANGER)
  async sshTestConnection(@Param('id') id: string) {
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    if (!config.sshHost) throw new BadRequestException('SSH host not configured');
    try {
      const sshConfig = this.configService.serverConfigToSshConfig(config);
      const client = await this.sshPool.getConnection(sshConfig);
      this.sshPool.release(config.id, client);
      return { success: true, message: 'SSH connection successful' };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Connection failed' };
    }
  }

  @Get(':id/ssh/status')
  @Roles(RoleLevel.VIEWER)
  sshStatus(@Param('id') id: string) {
    return {
      connected: this.sshPool.isConnected(id),
      observability: this.sshTerminal.getObservabilitySnapshot(id),
    };
  }

  @Get(':id/ssh/sessions')
  @Roles(RoleLevel.VIEWER)
  sshSessions(@Param('id') id: string) {
    return {
      connected: this.sshPool.isConnected(id),
      sessions: this.sshTerminal.listActiveSessions(id),
    };
  }

  // ── Scheduled Stop / Restart ──

  @Post(':id/scheduled-stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.scheduled-stop')
  async scheduleStop(
    @Param('id') id: string,
    @Body() body: { stopAt: string; mode?: 'graceful' | 'force' },
  ) {
    if (!body.stopAt) throw new BadRequestException('stopAt is required');
    const stopAt = new Date(body.stopAt);
    if (isNaN(stopAt.getTime())) throw new BadRequestException('Invalid stopAt date');
    this.scheduledStop.schedule(id, stopAt, body.mode ?? 'graceful');
    return { success: true, stopAt: stopAt.toISOString(), mode: body.mode ?? 'graceful' };
  }

  @Post(':id/scheduled-restart')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.scheduled-restart')
  async scheduleRestart(
    @Param('id') id: string,
    @Body() body: { restartAt: string },
  ) {
    if (!body.restartAt) throw new BadRequestException('restartAt is required');
    const restartAt = new Date(body.restartAt);
    if (isNaN(restartAt.getTime())) throw new BadRequestException('Invalid restartAt date');
    const config = await this.configService.getById(id);
    if (!config) throw new NotFoundException(`Server config ${id} not found`);
    this.scheduledStop.schedule(id, restartAt, 'graceful', 'scheduled-restart');
    return { success: true, restartAt: restartAt.toISOString() };
  }

  @Get(':id/scheduled-stop')
  @Roles(RoleLevel.VIEWER)
  getScheduledStop(@Param('id') id: string) {
    return this.scheduledStop.getScheduled(id);
  }

  @Delete(':id/scheduled-stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.cancel-scheduled-stop')
  cancelScheduledStop(@Param('id') id: string) {
    const cancelled = this.scheduledStop.cancel(id);
    return { success: cancelled };
  }

  // ── Conditional Stop ──

  @Get(':id/conditional-stop')
  @Roles(RoleLevel.VIEWER)
  getConditionalStop(@Param('id') id: string): ConditionalStopDto | null {
    const condition = this.conditionalStop.getCondition(id);
    if (!condition) return null;
    return { serverId: id, type: condition.type, params: condition.params };
  }

  @Put(':id/conditional-stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.set-conditional-stop')
  setConditionalStop(
    @Param('id') id: string,
    @Body() body: { type: string; params: Record<string, number> },
  ): ConditionalStopDto {
    if (!body.type) throw new BadRequestException('type is required');
    const condition: StopCondition = {
      type: body.type as StopCondition['type'],
      params: body.params ?? {},
    };
    this.conditionalStop.setCondition(id, condition);
    return { serverId: id, type: condition.type, params: condition.params };
  }

  @Delete(':id/conditional-stop')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.clear-conditional-stop')
  clearConditionalStop(@Param('id') id: string) {
    this.conditionalStop.clearCondition(id);
    return { success: true };
  }

  // ── Health Status ──

  @Get(':id/health')
  @Roles(RoleLevel.VIEWER)
  getHealthStatus(@Param('id') id: string) {
    const isUnresponsive = this.healthMonitor.isUnresponsive(id);
    const restartCount = this.crashRestart.getRestartCount(id);
    const status = this.processManager.getStatus(id);
    const uptime = status.uptime;

    // Calculate health score (0-100)
    let healthScore = 100;
    const issues: string[] = [];

    if (isUnresponsive) {
      healthScore -= 50;
      issues.push('服务器无响应');
    }
    if (restartCount > 0) {
      healthScore -= Math.min(restartCount * 10, 30);
      issues.push(`已重启 ${restartCount} 次`);
    }

    return {
      serverId: id,
      pidAlive: status.pid ? true : false,
      unresponsive: isUnresponsive,
      restartCount,
      uptime,
      healthScore: Math.max(0, healthScore),
      issues,
      monitoredServers: this.healthMonitor.getMonitoredServers(),
    };
  }

  @Get(':id/restart-history')
  @Roles(RoleLevel.VIEWER)
  async getRestartHistory(@Param('id') id: string, @Query('limit') limitStr?: string) {
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));
    return this.crashRestart.getRestartHistory(id, limit);
  }

  @Get(':id/metrics')
  @Roles(RoleLevel.VIEWER)
  async getProcessMetrics(
    @Param('id') id: string,
    @Query('from') from?: string,
  ) {
    const since = from || new Date(Date.now() - 3600_000).toISOString();
    const metrics = await this.metricsStore.query(id, since);
    return { serverId: id, metrics };
  }

  @Get(':id/metrics/summary')
  @Roles(RoleLevel.VIEWER)
  async getMetricsSummary(@Param('id') id: string) {
    const metrics = await this.metricsStore.query(id, new Date(Date.now() - 3600_000).toISOString());
    const current = metrics[metrics.length - 1] ?? null;
    const peak = {
      cpuPercent: Math.max(...metrics.map(m => m.cpuPercent), 0),
      rssBytes: Math.max(...metrics.map(m => m.rssBytes), 0),
    };
    const avg = {
      cpuPercent: metrics.length ? metrics.reduce((s, m) => s + m.cpuPercent, 0) / metrics.length : 0,
      rssBytes: metrics.length ? metrics.reduce((s, m) => s + m.rssBytes, 0) / metrics.length : 0,
    };
    return { serverId: id, current, peak, average: avg };
  }

  // ── Config Snapshots ──

  @Get(':id/snapshots')
  @Roles(RoleLevel.VIEWER)
  async listSnapshots(@Param('id') id: string) {
    return this.configSnapshotService.list(id);
  }

  @Get(':id/snapshots/:snapId')
  @Roles(RoleLevel.VIEWER)
  async getSnapshot(@Param('id') _id: string, @Param('snapId') snapId: string) {
    return this.configSnapshotService.getById(snapId);
  }

  @Post(':id/snapshots/:snapId/restore')
  @Roles(RoleLevel.DANGER)
  @Auditable('server.snapshot-restore')
  async restoreSnapshot(@Param('id') id: string, @Param('snapId') snapId: string) {
    const snapshot = await this.configSnapshotService.getById(snapId);
    const config = JSON.parse(snapshot.configJson);
    return this.configService.update(id, config);
  }

}

import { Injectable, Logger } from '@nestjs/common';
import { JavaHelperService } from './java-helper.service.js';

export interface AutoAttachConfig {
  readonly enabled: boolean;
  readonly attachPhases: readonly string[];
}

interface ActiveAutoSession {
  readonly sessionId: string;
  readonly serverId: string;
  profilingActive: boolean;
  monitoringActive: boolean;
}

@Injectable()
export class JavaHelperAutoService {
  private readonly logger = new Logger(JavaHelperAutoService.name);
  private config: AutoAttachConfig = { enabled: false, attachPhases: [] };
  private activeSession: ActiveAutoSession | null = null;

  constructor(private readonly javaHelper: JavaHelperService) {}

  getConfig(): AutoAttachConfig {
    return this.config;
  }

  setConfig(config: AutoAttachConfig): void {
    this.config = {
      enabled: config.enabled,
      attachPhases: [...config.attachPhases],
    };
    this.logger.log(`Auto-attach config updated: enabled=${config.enabled}, phases=${config.attachPhases.join(',')}`);
  }

  async onSessionStarted(sessionId: string, serverId: string): Promise<void> {
    if (!this.config.enabled) return;

    this.logger.log(`Auto-attach: session ${sessionId} started for server ${serverId}`);
    this.activeSession = {
      sessionId,
      serverId,
      profilingActive: false,
      monitoringActive: false,
    };

    try {
      await this.javaHelper.sendCommand('auto-session-start', {
        profilingEnabled: this.config.attachPhases.includes('profiling'),
        exceptionMonitorEnabled: this.config.attachPhases.includes('exception-monitor'),
      });
    } catch (err) {
      this.logger.warn(`Auto-attach start failed: ${err}`);
    }
  }

  async onPhaseEntered(sessionId: string, phaseName: string): Promise<void> {
    if (!this.config.enabled || !this.activeSession) return;
    if (!this.config.attachPhases.includes(phaseName)) return;

    this.logger.log(`Auto-attach: phase ${phaseName} entered, starting sampling`);
    try {
      await this.javaHelper.sendCommand('profile-start', { durationSeconds: 30 });
      this.activeSession.profilingActive = true;
    } catch (err) {
      this.logger.warn(`Auto-attach profiling start failed: ${err}`);
    }
  }

  async onPhaseExited(sessionId: string, phaseName: string): Promise<void> {
    if (!this.activeSession?.profilingActive) return;

    this.logger.log(`Auto-attach: phase ${phaseName} exited, stopping sampling`);
    try {
      await this.javaHelper.sendCommand('profile-stop');
      this.activeSession.profilingActive = false;
    } catch (err) {
      this.logger.warn(`Auto-attach profiling stop failed: ${err}`);
    }
  }

  async onSessionEnded(sessionId: string): Promise<void> {
    if (!this.activeSession || this.activeSession.sessionId !== sessionId) return;

    this.logger.log(`Auto-attach: session ${sessionId} ended, cleaning up`);
    try {
      await this.javaHelper.sendCommand('auto-session-stop');
    } catch (err) {
      this.logger.warn(`Auto-attach cleanup failed: ${err}`);
    }
    this.activeSession = null;
  }

  isAutoSessionActive(): boolean {
    return this.activeSession !== null;
  }

  getActiveSession(): ActiveAutoSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }
}

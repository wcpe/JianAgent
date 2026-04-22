import { Injectable } from '@nestjs/common';
import type { PlatformRuntimeCapabilityDto } from '@jian-agent/shared-domain';

@Injectable()
export class PlatformRuntimeService {
  getCapabilities(): PlatformRuntimeCapabilityDto {
    return {
      storageDialect: this.readStorageDialect(),
      logBackendMode: this.readLogBackendMode(),
      probeRuntimeKind: this.readProbeRuntimeKind(),
      realtimeCapacityMode: this.readRealtimeCapacityMode(),
    };
  }

  private readStorageDialect(): PlatformRuntimeCapabilityDto['storageDialect'] {
    const configured = process.env['STORAGE_DIALECT'];
    if (configured === 'postgresql' || configured === 'mysql' || configured === 'sqlite') {
      return configured;
    }
    return 'sqlite';
  }

  private readLogBackendMode(): PlatformRuntimeCapabilityDto['logBackendMode'] {
    const configured = process.env['LOG_BACKEND_MODE'];
    if (configured === 'loki' || configured === 'hybrid' || configured === 'local-file') {
      return configured;
    }
    return 'local-file';
  }

  private readProbeRuntimeKind(): PlatformRuntimeCapabilityDto['probeRuntimeKind'] {
    const configured = process.env['PROBE_RUNTIME_KIND'];
    if (
      configured === 'paper-1.20.4' ||
      configured === 'paper-1.21+' ||
      configured === 'folia' ||
      configured === 'velocity' ||
      configured === 'fabric' ||
      configured === 'forge' ||
      configured === 'unknown'
    ) {
      return configured;
    }
    return 'paper-1.20.4';
  }

  private readRealtimeCapacityMode(): PlatformRuntimeCapabilityDto['realtimeCapacityMode'] {
    return process.env['REALTIME_CAPACITY_MODE'] === 'high-scale' ? 'high-scale' : 'standard';
  }
}

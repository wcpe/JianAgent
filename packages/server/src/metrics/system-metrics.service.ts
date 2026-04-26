import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as os from 'os';
import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';

export interface SystemSnapshot {
  timestamp: string;
  cpuUsagePercent: number;
  cpuCount: number;
  loadAvg1m: number;
  loadAvg5m: number;
  loadAvg15m: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
  usedMemoryPercent: number;
  uptimeSeconds: number;
  disks: DiskInfo[];
  networkRxBytesPerSec: number;
  networkTxBytesPerSec: number;
}

export interface DiskInfo {
  filesystem: string;
  totalBlocks: number;
  usedBlocks: number;
  availableBlocks: number;
  capacityPercent: number;
  mountedOn: string;
}

interface CpuTick {
  idle: number;
  total: number;
}

interface NetworkCounter {
  rxBytes: number;
  txBytes: number;
  timestamp: number;
}

@Injectable()
export class SystemMetricsService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemMetricsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly buffer: SystemSnapshot[] = [];
  private static readonly MAX_BUFFER = 360;
  private static readonly INTERVAL_MS = 10_000;

  private prevCpuTicks: CpuTick[] = [];
  private prevNetCounter: NetworkCounter | null = null;

  private insertStmt: { run: (...params: any[]) => any } | null = null;

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {
    super();
  }

  onModuleInit(): void {
    this.ensureTable();
    this.prevCpuTicks = this.readCpuTicks();
    this.readNetworkCounters().then((c) => {
      this.prevNetCounter = c;
    }).catch(() => { /* ignore */ });

    this.timer = setInterval(() => {
      this.collect().catch((err) => {
        this.logger.error(`System metrics collection failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, SystemMetricsService.INTERVAL_MS);
    this.logger.log('System metrics collection started (10s interval)');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ---- public API ----

  getLatest(): SystemSnapshot | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1]! : null;
  }

  getHistory(startTime?: string, endTime?: string, limit = 120): SystemSnapshot[] {
    const client = this.db.$client;
    const sql = `
      SELECT * FROM system_metrics
      WHERE (? IS NULL OR timestamp >= ?) AND (? IS NULL OR timestamp <= ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    const rows = client.prepare(sql).all(
      startTime ?? null, startTime ?? null,
      endTime ?? null, endTime ?? null,
      limit,
    ) as any[];
    return rows.map((r) => this.rowToSnapshot(r)).reverse();
  }

  getBuffer(): readonly SystemSnapshot[] {
    return this.buffer;
  }

  // ---- private ----

  private ensureTable(): void {
    this.db.$client.exec(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        cpu_usage_percent REAL,
        cpu_count INTEGER,
        load_avg_1m REAL,
        load_avg_5m REAL,
        load_avg_15m REAL,
        total_memory_mb REAL,
        free_memory_mb REAL,
        used_memory_percent REAL,
        uptime_seconds INTEGER,
        disks_json TEXT,
        network_rx_bytes_per_sec REAL,
        network_tx_bytes_per_sec REAL
      );
    `);

    this.insertStmt = this.db.$client.prepare(`
      INSERT INTO system_metrics
        (timestamp, cpu_usage_percent, cpu_count, load_avg_1m, load_avg_5m, load_avg_15m,
         total_memory_mb, free_memory_mb, used_memory_percent, uptime_seconds, disks_json,
         network_rx_bytes_per_sec, network_tx_bytes_per_sec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  private async collect(): Promise<void> {
    const cpuUsage = this.calcCpuUsage();
    const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg();
    const totalMem = os.totalmem() / (1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024);
    const usedPercent = ((totalMem - freeMem) / totalMem) * 100;

    const disks = await this.collectDisks();
    const network = await this.collectNetwork();

    const snapshot: SystemSnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: Math.round(cpuUsage * 100) / 100,
      cpuCount: os.cpus().length,
      loadAvg1m: loadAvg1!,
      loadAvg5m: loadAvg5!,
      loadAvg15m: loadAvg15!,
      totalMemoryMb: Math.round(totalMem * 100) / 100,
      freeMemoryMb: Math.round(freeMem * 100) / 100,
      usedMemoryPercent: Math.round(usedPercent * 100) / 100,
      uptimeSeconds: Math.floor(os.uptime()),
      disks,
      networkRxBytesPerSec: network.rxBytesPerSec,
      networkTxBytesPerSec: network.txBytesPerSec,
    };

    // Buffer
    this.buffer.push(snapshot);
    if (this.buffer.length > SystemMetricsService.MAX_BUFFER) {
      this.buffer.splice(0, this.buffer.length - SystemMetricsService.MAX_BUFFER);
    }

    // Persist
    try {
      this.insertStmt?.run(
        snapshot.timestamp,
        snapshot.cpuUsagePercent,
        snapshot.cpuCount,
        snapshot.loadAvg1m,
        snapshot.loadAvg5m,
        snapshot.loadAvg15m,
        snapshot.totalMemoryMb,
        snapshot.freeMemoryMb,
        snapshot.usedMemoryPercent,
        snapshot.uptimeSeconds,
        JSON.stringify(snapshot.disks),
        snapshot.networkRxBytesPerSec,
        snapshot.networkTxBytesPerSec,
      );
    } catch (err) {
      this.logger.warn(`Failed to persist system metric: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.emit('system.snapshot', snapshot);
  }

  // ---- CPU ----

  private readCpuTicks(): CpuTick[] {
    return os.cpus().map((cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return { idle: cpu.times.idle, total };
    });
  }

  private calcCpuUsage(): number {
    const current = this.readCpuTicks();
    if (this.prevCpuTicks.length === 0) {
      this.prevCpuTicks = current;
      return 0;
    }
    let totalIdleDelta = 0;
    let totalDelta = 0;
    const len = Math.min(current.length, this.prevCpuTicks.length);
    for (let i = 0; i < len; i++) {
      const idleDelta = current[i]!.idle - this.prevCpuTicks[i]!.idle;
      const totalD = current[i]!.total - this.prevCpuTicks[i]!.total;
      totalIdleDelta += idleDelta;
      totalDelta += totalD;
    }
    this.prevCpuTicks = current;
    if (totalDelta === 0) return 0;
    return ((totalDelta - totalIdleDelta) / totalDelta) * 100;
  }

  // ---- Disk ----

  private collectDisks(): Promise<DiskInfo[]> {
    return new Promise((resolve) => {
      execFile('df', ['-P'], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const lines = stdout.trim().split('\n').slice(1); // skip header
        const disks: DiskInfo[] = [];
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length < 6) continue;
          const fs = parts[0]!;
          if (fs === 'tmpfs' || fs === 'devtmpfs' || fs.startsWith('map ')) continue;
          const totalBlocks = parseInt(parts[1]!, 10) || 0;
          const usedBlocks = parseInt(parts[2]!, 10) || 0;
          const availableBlocks = parseInt(parts[3]!, 10) || 0;
          const capStr = parts[4]!.replace('%', '');
          const capacityPercent = parseInt(capStr, 10) || 0;
          const mountedOn = parts.slice(5).join(' ');
          disks.push({ filesystem: fs, totalBlocks, usedBlocks, availableBlocks, capacityPercent, mountedOn });
        }
        resolve(disks);
      });
    });
  }

  // ---- Network ----

  private async collectNetwork(): Promise<{ rxBytesPerSec: number; txBytesPerSec: number }> {
    let current: NetworkCounter | null = null;
    try {
      current = await this.readNetworkCounters();
    } catch {
      // ignore
    }

    if (!current || !this.prevNetCounter) {
      if (current) this.prevNetCounter = current;
      return { rxBytesPerSec: 0, txBytesPerSec: 0 };
    }

    const elapsed = (current.timestamp - this.prevNetCounter.timestamp) / 1000;
    if (elapsed <= 0) {
      this.prevNetCounter = current;
      return { rxBytesPerSec: 0, txBytesPerSec: 0 };
    }

    const rxPerSec = Math.max(0, (current.rxBytes - this.prevNetCounter.rxBytes) / elapsed);
    const txPerSec = Math.max(0, (current.txBytes - this.prevNetCounter.txBytes) / elapsed);
    this.prevNetCounter = current;
    return {
      rxBytesPerSec: Math.round(rxPerSec * 100) / 100,
      txBytesPerSec: Math.round(txPerSec * 100) / 100,
    };
  }

  private async readNetworkCounters(): Promise<NetworkCounter> {
    const platform = os.platform();
    if (platform === 'linux') {
      return this.readLinuxNetwork();
    } else if (platform === 'darwin') {
      return this.readMacOsNetwork();
    }
    return { rxBytes: 0, txBytes: 0, timestamp: Date.now() };
  }

  private async readLinuxNetwork(): Promise<NetworkCounter> {
    const data = await readFile('/proc/net/dev', 'utf-8');
    const lines = data.trim().split('\n').slice(2); // skip header lines
    let totalRx = 0;
    let totalTx = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const iface = parts[0]!.replace(':', '');
      if (iface === 'lo') continue;
      totalRx += parseInt(parts[1]!, 10) || 0;
      totalTx += parseInt(parts[9]!, 10) || 0;
    }
    return { rxBytes: totalRx, txBytes: totalTx, timestamp: Date.now() };
  }

  private readMacOsNetwork(): Promise<NetworkCounter> {
    return new Promise((resolve, reject) => {
      execFile('netstat', ['-ib'], { timeout: 5000 }, (err, stdout) => {
        if (err) { reject(err); return; }
        const lines = stdout.trim().split('\n');
        if (lines.length < 2) { resolve({ rxBytes: 0, txBytes: 0, timestamp: Date.now() }); return; }
        // Parse header to find column indices
        const header = lines[0]!.split(/\s+/);
        const ibyteIdx = header.indexOf('Ibytes');
        const obyteIdx = header.indexOf('Obytes');
        if (ibyteIdx < 0 || obyteIdx < 0) {
          resolve({ rxBytes: 0, txBytes: 0, timestamp: Date.now() });
          return;
        }
        let totalRx = 0;
        let totalTx = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i]!.split(/\s+/);
          const iface = cols[0] ?? '';
          if (iface === 'lo0' || !cols[ibyteIdx]) continue;
          totalRx += parseInt(cols[ibyteIdx]!, 10) || 0;
          totalTx += parseInt(cols[obyteIdx]!, 10) || 0;
        }
        resolve({ rxBytes: totalRx, txBytes: totalTx, timestamp: Date.now() });
      });
    });
  }

  // ---- Helpers ----

  private rowToSnapshot(row: any): SystemSnapshot {
    return {
      timestamp: row.timestamp,
      cpuUsagePercent: row.cpu_usage_percent ?? 0,
      cpuCount: row.cpu_count ?? 0,
      loadAvg1m: row.load_avg_1m ?? 0,
      loadAvg5m: row.load_avg_5m ?? 0,
      loadAvg15m: row.load_avg_15m ?? 0,
      totalMemoryMb: row.total_memory_mb ?? 0,
      freeMemoryMb: row.free_memory_mb ?? 0,
      usedMemoryPercent: row.used_memory_percent ?? 0,
      uptimeSeconds: row.uptime_seconds ?? 0,
      disks: row.disks_json ? JSON.parse(row.disks_json) : [],
      networkRxBytesPerSec: row.network_rx_bytes_per_sec ?? 0,
      networkTxBytesPerSec: row.network_tx_bytes_per_sec ?? 0,
    };
  }
}

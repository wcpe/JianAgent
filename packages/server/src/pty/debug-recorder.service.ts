import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { nanoid } from 'nanoid';

interface ActiveRecording {
  readonly recordingId: string;
  readonly startTime: number;
  eventBuffer: Array<{ offsetMs: number; eventType: string; data: string }>;
}

export interface DebugRecordingRow {
  readonly id: string;
  readonly sessionId: string;
  readonly serverId: string;
  readonly startedAt: number;
  readonly stoppedAt: number | null;
  readonly sizeBytes: number;
  readonly eventCount: number;
  readonly status: string;
}

export interface DebugRecordingEventRow {
  readonly id: number;
  readonly recordingId: string;
  readonly offsetMs: number;
  readonly eventType: string;
  readonly data: string;
}

@Injectable()
export class DebugRecorderService {
  private readonly logger = new Logger(DebugRecorderService.name);
  private readonly activeRecordings = new Map<string, ActiveRecording>();

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async startRecording(sessionId: string, serverId: string): Promise<string> {
    const id = nanoid();
    const now = Date.now();

    // We'll use raw SQL through better-sqlite3 since the schema migration
    // for debug_recordings will be added in the consolidation step
    try {
      const stmt = `INSERT INTO debug_recordings (id, session_id, server_id, started_at, stopped_at, size_bytes, event_count, status) VALUES (?, ?, ?, ?, NULL, 0, 0, 'recording')`;
      (this.db as any).run?.(stmt, id, sessionId, serverId, now) ??
        await this.runRawInsert(
          'debug_recordings',
          { id, session_id: sessionId, server_id: serverId, started_at: now, stopped_at: null, size_bytes: 0, event_count: 0, status: 'recording' },
        );
    } catch {
      this.logger.warn('debug_recordings table not yet created; recording in-memory only');
    }

    this.activeRecordings.set(serverId, {
      recordingId: id,
      startTime: now,
      eventBuffer: [],
    });

    this.logger.log(`Started recording ${id} for server ${serverId}`);
    return id;
  }

  recordEvent(serverId: string, eventType: 'output' | 'input' | 'resize', data: string): void {
    const active = this.activeRecordings.get(serverId);
    if (!active) return;

    const offsetMs = Date.now() - active.startTime;
    active.eventBuffer.push({ offsetMs, eventType, data });

    if (active.eventBuffer.length >= 100) {
      void this.flushBuffer(serverId);
    }
  }

  async stopRecording(serverId: string): Promise<string | null> {
    const active = this.activeRecordings.get(serverId);
    if (!active) return null;

    await this.flushBuffer(serverId);
    this.activeRecordings.delete(serverId);

    const now = Date.now();
    try {
      await this.runRawUpdate(
        'debug_recordings',
        { stopped_at: now, status: 'completed' },
        { id: active.recordingId },
      );
    } catch {
      this.logger.warn('Failed to update recording status in DB');
    }

    this.logger.log(`Stopped recording ${active.recordingId}`);
    return active.recordingId;
  }

  isRecording(serverId: string): boolean {
    return this.activeRecordings.has(serverId);
  }

  getActiveRecordingId(serverId: string): string | null {
    return this.activeRecordings.get(serverId)?.recordingId ?? null;
  }

  async listRecordings(sessionId?: string): Promise<DebugRecordingRow[]> {
    try {
      let query = 'SELECT * FROM debug_recordings';
      const params: unknown[] = [];
      if (sessionId) {
        query += ' WHERE session_id = ?';
        params.push(sessionId);
      }
      query += ' ORDER BY started_at DESC';
      return this.runRawSelect<DebugRecordingRow>(query, params);
    } catch {
      return [];
    }
  }

  async getRecordingEvents(
    recordingId: string,
    fromMs?: number,
  ): Promise<DebugRecordingEventRow[]> {
    try {
      let query = 'SELECT * FROM debug_recording_events WHERE recording_id = ?';
      const params: unknown[] = [recordingId];
      if (fromMs != null) {
        query += ' AND offset_ms >= ?';
        params.push(fromMs);
      }
      query += ' ORDER BY offset_ms ASC';
      return this.runRawSelect<DebugRecordingEventRow>(query, params);
    } catch {
      return [];
    }
  }

  async deleteRecording(id: string): Promise<void> {
    try {
      await this.runRawDelete('debug_recording_events', { recording_id: id });
      await this.runRawDelete('debug_recordings', { id });
    } catch {
      this.logger.warn(`Failed to delete recording ${id}`);
    }
  }

  private async flushBuffer(serverId: string): Promise<void> {
    const active = this.activeRecordings.get(serverId);
    if (!active || active.eventBuffer.length === 0) return;

    const events = active.eventBuffer.splice(0, active.eventBuffer.length);

    try {
      for (const e of events) {
        await this.runRawInsert('debug_recording_events', {
          recording_id: active.recordingId,
          offset_ms: e.offsetMs,
          event_type: e.eventType,
          data: e.data,
        });
      }

      const totalSize = events.reduce((s, e) => s + e.data.length, 0);
      await this.runRawExec(
        `UPDATE debug_recordings SET size_bytes = size_bytes + ?, event_count = event_count + ? WHERE id = ?`,
        [totalSize, events.length, active.recordingId],
      );
    } catch (err) {
      this.logger.warn(`Failed to flush recording events: ${err}`);
      // Re-add events to buffer
      active.eventBuffer.unshift(...events);
    }
  }

  // --- raw SQL helpers (tables created via migration in schema consolidation) ---

  private runRawInsert(table: string, values: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(values);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return this.runRawExec(sql, Object.values(values));
  }

  private runRawUpdate(
    table: string,
    set: Record<string, unknown>,
    where: Record<string, unknown>,
  ): Promise<void> {
    const setClauses = Object.keys(set).map((k) => `${k} = ?`).join(', ');
    const whereClauses = Object.keys(where).map((k) => `${k} = ?`).join(' AND ');
    const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`;
    return this.runRawExec(sql, [...Object.values(set), ...Object.values(where)]);
  }

  private runRawDelete(table: string, where: Record<string, unknown>): Promise<void> {
    const whereClauses = Object.keys(where).map((k) => `${k} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereClauses}`;
    return this.runRawExec(sql, Object.values(where));
  }

  private runRawExec(sql: string, params: unknown[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Access underlying better-sqlite3 through drizzle's session
        const session = (this.db as any).session;
        const client = session?.client;
        if (client?.prepare) {
          client.prepare(sql).run(...params);
          resolve();
        } else {
          reject(new Error('Cannot access raw SQLite client'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  private runRawSelect<T>(sql: string, params: unknown[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      try {
        const session = (this.db as any).session;
        const client = session?.client;
        if (client?.prepare) {
          const rows = client.prepare(sql).all(...params);
          resolve(rows as T[]);
        } else {
          reject(new Error('Cannot access raw SQLite client'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

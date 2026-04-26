import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import type {
  LogSearchRequest,
  LogSearchResult,
  LogEntryDto,
  LogAnalyticsResult,
} from '@jian-agent/shared-domain';

interface FtsSearchRow {
  id: number;
  host_id: string;
  host_name: string;
  host_type: string;
  source_file: string;
  line_number: number;
  timestamp: string;
  level: string;
  content: string;
  raw_line: string;
  snippet_content?: string;
}

@Injectable()
export class LogSearchService {
  private readonly logger = new Logger(LogSearchService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  /** Access raw better-sqlite3 instance via drizzle session */
  private get rawSqlite() {
    const session = (this.db as any).session;
    return session?.client;
  }

  /** Full-text search via FTS5 MATCH with snippet highlight and pagination */
  ftsSearch(req: LogSearchRequest): LogSearchResult {
    const page = Math.max(1, req.page ?? 1);
    const limit = Math.min(200, Math.max(1, req.limit ?? 50));
    const offset = (page - 1) * limit;
    const query = (req.q ?? '').trim();

    if (!query) {
      return { entries: [], total: 0, page, limit, highlightMap: new Map() };
    }

    const client = this.rawSqlite;
    if (!client) {
      this.logger.error('Cannot access raw SQLite client for FTS5 search');
      return { entries: [], total: 0, page, limit, highlightMap: new Map() };
    }

    // Sanitize FTS query: wrap in quotes for phrase matching, escape inner quotes
    const ftsQuery = `"${query.replace(/"/g, '""')}"`;

    // Build WHERE clauses for optional filters
    const conditions: string[] = ['log_entries_fts MATCH ?'];
    const params: unknown[] = [ftsQuery];

    if (req.hosts?.length) {
      const placeholders = req.hosts.map(() => '?').join(',');
      conditions.push(`e.host_id IN (${placeholders})`);
      params.push(...req.hosts);
    }
    if (req.level) {
      conditions.push('e.level = ?');
      params.push(req.level);
    }
    if (req.startTime) {
      conditions.push('e.timestamp >= ?');
      params.push(req.startTime);
    }
    if (req.endTime) {
      conditions.push('e.timestamp <= ?');
      params.push(req.endTime);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countSql = `
      SELECT COUNT(*) as cnt
      FROM log_entries_fts
      JOIN log_entries_new e ON e.id = log_entries_fts.rowid
      WHERE ${whereClause}
    `;

    let total: number;
    try {
      const countRow = client.prepare(countSql).get(...params) as { cnt: number } | undefined;
      total = countRow?.cnt ?? 0;
    } catch (err: unknown) {
      this.logger.warn(`FTS5 count query failed: ${err instanceof Error ? err.message : String(err)}`);
      return { entries: [], total: 0, page, limit, highlightMap: new Map() };
    }

    if (total === 0) {
      return { entries: [], total: 0, page, limit, highlightMap: new Map() };
    }

    // Fetch rows with snippet highlight
    const dataSql = `
      SELECT
        e.id,
        e.host_id,
        e.host_name,
        e.host_type,
        e.source_file,
        e.line_number,
        e.timestamp,
        e.level,
        e.content,
        e.raw_line,
        snippet(log_entries_fts, 0, '<mark>', '</mark>', '…', 32) as snippet_content
      FROM log_entries_fts
      JOIN log_entries_new e ON e.id = log_entries_fts.rowid
      WHERE ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    let rows: FtsSearchRow[];
    try {
      rows = client.prepare(dataSql).all(...params, limit, offset) as FtsSearchRow[];
    } catch (err: unknown) {
      this.logger.warn(`FTS5 data query failed: ${err instanceof Error ? err.message : String(err)}`);
      return { entries: [], total: 0, page, limit, highlightMap: new Map() };
    }

    const entries: LogEntryDto[] = rows.map((r) => ({
      id: r.id,
      hostId: r.host_id,
      hostName: r.host_name,
      hostType: r.host_type,
      sourceFile: r.source_file,
      timestamp: r.timestamp,
      level: r.level,
      content: r.content,
      rawLine: r.raw_line,
    }));

    const highlightMap = new Map<number, string>();
    for (const r of rows) {
      if (r.snippet_content) {
        highlightMap.set(r.id, r.snippet_content);
      }
    }

    return { entries, total, page, limit, highlightMap };
  }

  /** Analytics: level distribution, timeline buckets, top keywords */
  getAnalytics(opts: {
    hostId?: string;
    startTime?: string;
    endTime?: string;
    buckets?: number;
  }): LogAnalyticsResult {
    const client = this.rawSqlite;
    if (!client) {
      this.logger.error('Cannot access raw SQLite client for analytics');
      return { levelDistribution: {}, timelineBuckets: [], topKeywords: [] };
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.hostId) {
      conditions.push('host_id = ?');
      params.push(opts.hostId);
    }
    if (opts.startTime) {
      conditions.push('timestamp >= ?');
      params.push(opts.startTime);
    }
    if (opts.endTime) {
      conditions.push('timestamp <= ?');
      params.push(opts.endTime);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Level distribution
    const levelSql = `SELECT level, COUNT(*) as cnt FROM log_entries_new ${where} GROUP BY level ORDER BY cnt DESC`;
    let levelRows: Array<{ level: string; cnt: number }>;
    try {
      levelRows = client.prepare(levelSql).all(...params) as any[];
    } catch (err) {
      this.logger.debug('Level distribution query failed', err);
      levelRows = [];
    }

    const levelDistribution: Record<string, number> = {};
    for (const r of levelRows) {
      levelDistribution[r.level] = r.cnt;
    }

    // 2. Timeline buckets (hourly by default)
    const bucketCount = Math.min(200, Math.max(1, opts.buckets ?? 24));
    const timelineSql = `
      SELECT
        substr(timestamp, 1, 16) as bucket,
        COUNT(*) as cnt
      FROM log_entries_new
      ${where}
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT ?
    `;
    let timelineRows: Array<{ bucket: string; cnt: number }>;
    try {
      timelineRows = client.prepare(timelineSql).all(...params, bucketCount) as any[];
    } catch (err) {
      this.logger.debug('Timeline bucket query failed', err);
      timelineRows = [];
    }

    const timelineBuckets = timelineRows.map((r) => ({
      time: r.bucket,
      count: r.cnt,
    }));

    // 3. Top keywords (split content on non-word chars, count top terms)
    // Use FTS5 vocab table for fast word frequency
    let topKeywords: Array<{ word: string; count: number }> = [];
    try {
      const vocabSql = `
        SELECT term, doc
        FROM log_entries_fts_vocab
        ORDER BY doc DESC
        LIMIT 20
      `;
      const vocabRows = client.prepare(vocabSql).all() as Array<{ term: string; doc: number }>;
      // Filter out very short terms and common stopwords
      const stopwords = new Set(['the', 'a', 'an', 'is', 'to', 'in', 'of', 'for', 'and', 'or', 'at', 'on', 'by', 'it', 'as', 'be']);
      topKeywords = vocabRows
        .filter((r) => r.term.length > 2 && !stopwords.has(r.term))
        .slice(0, 10)
        .map((r) => ({ word: r.term, count: r.doc }));
    } catch (err: unknown) {
      this.logger.debug(`FTS5 vocab query skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Error trend (hourly buckets for ERROR-level entries)
    let errorTrend: Array<{ time: string; count: number }> = [];
    try {
      const errorConditions: string[] = ["level = 'ERROR'"];
      const errorParams: unknown[] = [];
      if (opts.startTime) {
        errorConditions.push('timestamp >= ?');
        errorParams.push(opts.startTime);
      }
      if (opts.endTime) {
        errorConditions.push('timestamp <= ?');
        errorParams.push(opts.endTime);
      }
      const errorWhere = `WHERE ${errorConditions.join(' AND ')}`;
      const errorTrendSql = `
        SELECT substr(timestamp, 1, 13) as bucket, COUNT(*) as cnt
        FROM log_entries_new
        ${errorWhere}
        GROUP BY bucket
        ORDER BY bucket
        LIMIT 168
      `;
      const errorRows = client.prepare(errorTrendSql).all(...errorParams) as Array<{ bucket: string; cnt: number }>;
      errorTrend = errorRows.map((r) => ({ time: r.bucket, count: r.cnt }));
    } catch (err: unknown) {
      this.logger.debug(`Error trend query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { levelDistribution, timelineBuckets, topKeywords, errorTrend };
  }

  /** Query ERROR/FATAL/SEVERE log entries in a time range for correlated timeline */
  getErrorsInRange(
    startTime: string,
    endTime: string,
    hosts?: string[],
    limit = 200,
  ): { timestamp: string; level: string; content: string; hostName: string }[] {
    const client = this.rawSqlite;
    if (!client) {
      this.logger.error('Cannot access raw SQLite client for error range query');
      return [];
    }

    const conditions: string[] = [
      "level IN ('ERROR', 'FATAL', 'SEVERE')",
      'timestamp >= ?',
      'timestamp <= ?',
    ];
    const params: unknown[] = [startTime, endTime];

    if (hosts?.length) {
      const placeholders = hosts.map(() => '?').join(',');
      conditions.push(`host_id IN (${placeholders})`);
      params.push(...hosts);
    }

    const whereClause = conditions.join(' AND ');
    const sql = `
      SELECT timestamp, level, content, host_name
      FROM log_entries_new
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    try {
      const rows = client.prepare(sql).all(...params, limit) as Array<{
        timestamp: string;
        level: string;
        content: string;
        host_name: string;
      }>;
      return rows.map((r) => ({
        timestamp: r.timestamp,
        level: r.level,
        content: r.content,
        hostName: r.host_name,
      }));
    } catch (err: unknown) {
      this.logger.warn(`Error range query failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}

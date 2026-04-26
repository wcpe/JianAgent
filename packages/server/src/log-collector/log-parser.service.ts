import { Injectable, Logger } from '@nestjs/common';

export interface ParsedLogLine {
  timestamp: string;
  level: string;
  content: string;
}

@Injectable()
export class LogParserService {
  private readonly logger = new Logger(LogParserService.name);

  parseLine(rawLine: string, format: string, baseTimestamp?: string): ParsedLogLine {
    const trimmed = rawLine.trimEnd();
    switch (format) {
      case 'mc':
        return this.parseMcLog(trimmed);
      case 'syslog':
        return this.parseSyslog(trimmed);
      case 'json':
        return this.parseJson(trimmed);
      case 'plain':
      default:
        return this.parsePlain(trimmed, baseTimestamp);
    }
  }

  /**
   * MC log format:
   * [HH:mm:ss] [Server thread/INFO]: Player joined
   * [HH:mm:ss] [Server thread/WARN]: Warning message
   * [HH:mm:ss] [Server thread/ERROR]: Error message
   */
  private parseMcLog(line: string): ParsedLogLine {
    const mcRegex = /^\[(\d{2}:\d{2}:\d{2})]\s*\[.*?\/(\w+)]:\s*(.*)/;
    const match = line.match(mcRegex);

    if (match) {
      const [, time, rawLevel, content] = match;
      return {
        timestamp: this.composeToday(time),
        level: this.normalizeLevel(rawLevel),
        content: content.trim(),
      };
    }

    // Subsequent lines without timestamp header
    return {
      timestamp: this.now(),
      level: 'INFO',
      content: line,
    };
  }

  /**
   * Syslog format:
   * Apr 14 14:30:00 hostname process[pid]: message
   */
  private parseSyslog(line: string): ParsedLogLine {
    const syslogRegex =
      /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+\S+:\s*(.*)/;
    const match = line.match(syslogRegex);

    if (match) {
      const [, datetime, content] = match;
      return {
        timestamp: this.parseSyslogTimestamp(datetime),
        level: this.detectLevel(content),
        content: content.trim(),
      };
    }

    return {
      timestamp: this.now(),
      level: this.detectLevel(line),
      content: line,
    };
  }

  /**
   * JSON log format:
   * {"timestamp":"...","level":"INFO","message":"..."}
   */
  private parseJson(line: string): ParsedLogLine {
    try {
      const obj = JSON.parse(line);
      return {
        timestamp:
          (typeof obj.timestamp === 'string' ? obj.timestamp : null) ??
          (typeof obj.time === 'string' ? obj.time : null) ??
          (typeof obj.ts === 'string' ? obj.ts : null) ??
          this.now(),
        level: this.normalizeLevel(
          (typeof obj.level === 'string' ? obj.level : null) ??
          (typeof obj.severity === 'string' ? obj.severity : null) ??
          'INFO',
        ),
        content:
          (typeof obj.message === 'string' ? obj.message : null) ??
          (typeof obj.msg === 'string' ? obj.msg : null) ??
          line,
      };
    } catch (_err) {
      return {
        timestamp: this.now(),
        level: 'INFO',
        content: line,
      };
    }
  }

  /** Plain text — whole line is content */
  private parsePlain(line: string, baseTimestamp?: string): ParsedLogLine {
    return {
      timestamp: baseTimestamp ?? this.now(),
      level: this.detectLevel(line),
      content: line,
    };
  }

  /** Normalize level string to uppercase standard levels */
  private normalizeLevel(raw: string): string {
    const upper = raw.toUpperCase().trim();
    const known = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL'];
    if (known.includes(upper)) {
      // Collapse WARNING -> WARN, CRITICAL -> FATAL
      if (upper === 'WARNING') return 'WARN';
      if (upper === 'CRITICAL') return 'FATAL';
      return upper;
    }
    return 'INFO';
  }

  /** Heuristic level detection from content */
  private detectLevel(content: string): string {
    const upper = content.toUpperCase();
    if (/\bERROR\b|\bFATAL\b|\bCRITICAL\b/.test(upper)) return 'ERROR';
    if (/\bWARN\b|\bWARNING\b/.test(upper)) return 'WARN';
    if (/\bDEBUG\b/.test(upper)) return 'DEBUG';
    if (/\bTRACE\b/.test(upper)) return 'TRACE';
    return 'INFO';
  }

  /** Compose ISO string from HH:mm:ss and today's date */
  private composeToday(time: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `${today}T${time}`;
  }

  /** Parse syslog "MMM DD HH:mm:ss" timestamp */
  private parseSyslogTimestamp(datetime: string): string {
    try {
      const year = new Date().getFullYear();
      const parsed = new Date(`${datetime} ${year}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch (_err) {
      // fall through
    }
    return this.now();
  }

  private now(): string {
    return new Date().toISOString();
  }
}

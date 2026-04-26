export interface ParsedLogLine {
  readonly timestamp: string;
  readonly level: string;
  readonly message: string;
  readonly raw: string;
  readonly source?: string;
}

// Minecraft log pattern: [HH:MM:SS LEVEL]: message
const MC_LOG_RE = /^\[(\d{2}:\d{2}:\d{2})\s+(FATAL|ERROR|WARN|INFO|DEBUG|TRACE)]:\s*(.*)$/;

// NestJS log pattern: [Nest] PID  - datetime     LEVEL [Context] message
const NEST_LOG_RE = /^\[Nest\]\s*\d+\s*-\s*(.+?)\s{2,}(\w+)\s+\[(.+?)]\s*(.*)/;

const LEVEL_NORMALIZATION: Readonly<Record<string, string>> = {
  LOG: 'INFO',
  VERBOSE: 'DEBUG',
  WARNING: 'WARN',
  SEVERE: 'ERROR',
  CRITICAL: 'FATAL',
};

function normalizeLevel(level: string): string {
  const upper = level.toUpperCase();
  return LEVEL_NORMALIZATION[upper] ?? upper;
}

/** Strip ANSI escape codes from text. */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Parse a single raw log line into a structured entry. */
export function parseLogLine(raw: string): ParsedLogLine {
  const stripped = stripAnsi(raw);

  // Try Minecraft format first
  const mcMatch = MC_LOG_RE.exec(stripped);
  if (mcMatch) {
    const [, timestamp, level, message] = mcMatch;
    return { timestamp, level: normalizeLevel(level), message, raw };
  }

  // Try NestJS format
  const nestMatch = NEST_LOG_RE.exec(stripped);
  if (nestMatch) {
    const [, timestamp, level, source, message] = nestMatch;
    return { timestamp: timestamp.trim(), level: normalizeLevel(level), message, raw, source };
  }

  // Fallback: treat entire line as INFO message
  return { timestamp: '', level: 'INFO', message: stripped, raw };
}

/** Check whether a parsed log entry matches the given filters. */
export function matchesFilters(
  entry: ParsedLogLine,
  filters: { levels?: string[]; keyword?: string },
): boolean {
  if (filters.levels && filters.levels.length > 0) {
    if (!filters.levels.includes(entry.level)) {
      return false;
    }
  }

  if (filters.keyword && filters.keyword.length > 0) {
    const lower = filters.keyword.toLowerCase();
    if (!entry.message.toLowerCase().includes(lower) && !entry.raw.toLowerCase().includes(lower)) {
      return false;
    }
  }

  return true;
}

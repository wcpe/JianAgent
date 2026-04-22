// ANSI escape codes
const RESET = '\x1b[0m';

const LEVEL_COLORS: Readonly<Record<string, string>> = {
  FATAL: '\x1b[1;31m',   // bold red
  ERROR: '\x1b[31m',     // red
  WARN:  '\x1b[33m',     // yellow
  INFO:  '\x1b[36m',     // cyan
  DEBUG: '\x1b[90m',     // gray
  TRACE: '\x1b[90m',     // gray
} as const;

const PLUGIN_COLOR = '\x1b[35m'; // magenta
const TIMESTAMP_COLOR = '\x1b[90m'; // gray

// Minecraft log pattern: [HH:MM:SS LEVEL]: message
const MC_LOG_RE = /^\[(\d{2}:\d{2}:\d{2})\s+(FATAL|ERROR|WARN|INFO|DEBUG|TRACE)]:\s*(.*)$/;

// Plugin prefix pattern: [PluginName]
const PLUGIN_RE = /\[([A-Za-z0-9_-]+)]/g;

export function colorizeLine(raw: string): string {
  const match = MC_LOG_RE.exec(raw);
  if (!match) return raw;

  const [, time, level, message] = match;
  const color = LEVEL_COLORS[level] ?? '';

  const colorizedMessage = message.replace(
    PLUGIN_RE,
    `${PLUGIN_COLOR}[$1]${color}`,
  );

  return `${TIMESTAMP_COLOR}[${time}]${RESET} ${color}${level}${RESET} ${color}${colorizedMessage}${RESET}`;
}

export function colorizeOutput(text: string): string {
  return text
    .split('\n')
    .map(colorizeLine)
    .join('\n');
}

/**
 * Minecraft MOTD color code renderer.
 * Parses § color/formatting codes and renders styled spans.
 */

const MC_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  a: '#55FF55',
  b: '#55FFFF',
  c: '#FF5555',
  d: '#FF55FF',
  e: '#FFFF55',
  f: '#FFFFFF',
};

interface MotdSpan {
  readonly text: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikethrough?: boolean;
}

function parseMotd(raw: string): readonly MotdSpan[] {
  const spans: MotdSpan[] = [];
  let color: string | undefined;
  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let buf = '';

  const flush = () => {
    if (buf.length > 0) {
      spans.push({ text: buf, color, bold: bold || undefined, italic: italic || undefined, underline: underline || undefined, strikethrough: strikethrough || undefined });
      buf = '';
    }
  };

  for (let i = 0; i < raw.length; i++) {
    if ((raw[i] === '§' || raw[i] === '\u00a7') && i + 1 < raw.length) {
      flush();
      const code = raw[i + 1].toLowerCase();
      if (MC_COLORS[code] !== undefined) {
        color = MC_COLORS[code];
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
      } else if (code === 'l') {
        bold = true;
      } else if (code === 'o') {
        italic = true;
      } else if (code === 'n') {
        underline = true;
      } else if (code === 'm') {
        strikethrough = true;
      } else if (code === 'r') {
        color = undefined;
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
      }
      i++; // skip code char
    } else {
      buf += raw[i];
    }
  }
  flush();
  return spans;
}

interface MotdRendererProps {
  readonly motdRaw?: string;
  readonly fallback?: string;
  readonly className?: string;
}

export function MotdRenderer({ motdRaw, fallback, className }: MotdRendererProps) {
  const text = motdRaw ?? fallback;
  if (!text) return null;

  const spans = parseMotd(text);
  return (
    <span className={className}>
      {spans.map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            fontWeight: s.bold ? 'bold' : undefined,
            fontStyle: s.italic ? 'italic' : undefined,
            textDecoration: [
              s.underline ? 'underline' : '',
              s.strikethrough ? 'line-through' : '',
            ].filter(Boolean).join(' ') || undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </span>
  );
}

/**
 * Ping latency signal strength indicator (MC-style bars).
 */
interface PingBarsProps {
  readonly latencyMs?: number;
}

export function PingBars({ latencyMs }: PingBarsProps) {
  if (latencyMs == null) return <span className="text-gray-500 text-xs">—</span>;

  // 5 bars, colored by latency
  const bars = latencyMs < 50 ? 5 : latencyMs < 100 ? 4 : latencyMs < 200 ? 3 : latencyMs < 400 ? 2 : 1;
  const barColor = bars >= 4 ? 'bg-green-500' : bars >= 3 ? 'bg-yellow-500' : bars >= 2 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <span className="inline-flex items-end gap-px h-3" title={`${latencyMs}ms`}>
      {[1, 2, 3, 4, 5].map((level) => (
        <span
          key={level}
          className={`w-[3px] rounded-sm ${level <= bars ? barColor : 'bg-gray-600'}`}
          style={{ height: `${level * 20}%` }}
        />
      ))}
    </span>
  );
}

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import type { ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';

/** Read CSS custom property value from :root. */
function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

/** Build an xterm ITheme from the active CSS variable palette. */
function buildXtermTheme(): ITheme {
  const bg = readCssVar('--terminal-bg', '#0f0f23');
  const fg = readCssVar('--terminal-fg', '#e2e8f0');
  const accent = readCssVar('--accent', '#6366f1');

  return {
    background: bg,
    foreground: fg,
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: accent + '40', // 25% opacity
    // ANSI colors — derive from fg/bg so they stay readable
    black: bg,
    red: '#f87171',
    green: '#4ade80',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: fg,
    brightBlack: '#64748b',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#f8fafc',
  };
}

export interface XTerminalHandle {
  write(data: string): void;
  clear(): void;
  focus(): void;
  fit(): void;
  search(query: string): void;
  findNext(query: string, options?: { caseSensitive?: boolean; regex?: boolean }): void;
  findPrevious(query: string, options?: { caseSensitive?: boolean; regex?: boolean }): void;
}

interface XTerminalProps {
  readonly readonly?: boolean;
  readonly localEcho?: boolean;
  readonly initialLines?: readonly string[];
  readonly onReady?: (terminal: Terminal) => void;
  readonly onData?: (data: string) => void;
  readonly className?: string;
}

export const XTerminal = forwardRef<XTerminalHandle, XTerminalProps>(function XTerminal(
  { readonly, localEcho, initialLines, onReady, onData, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const initialWrittenRef = useRef(false);

  useImperativeHandle(ref, () => ({
    write(data: string) {
      terminalRef.current?.write(data);
    },
    clear() {
      terminalRef.current?.clear();
    },
    focus() {
      terminalRef.current?.focus();
    },
    fit() {
      if (
        !containerRef.current || 
        containerRef.current.clientWidth === 0 || 
        containerRef.current.clientHeight === 0
      ) {
        return;
      }
      try {
        fitAddonRef.current?.fit();
      } catch (e) {
        console.warn('xterm.js fit() failed:', e);
      }
    },
    search(query: string) {
      if (!searchAddonRef.current || !query) return;
      searchAddonRef.current.findNext(query);
    },
    findNext(query: string, options?: { caseSensitive?: boolean; regex?: boolean }) {
      if (!searchAddonRef.current || !query) return;
      searchAddonRef.current.findNext(query, options);
    },
    findPrevious(query: string, options?: { caseSensitive?: boolean; regex?: boolean }) {
      if (!searchAddonRef.current || !query) return;
      searchAddonRef.current.findPrevious(query, options);
    },
  }));

  const handleDataRef = useRef(onData);
  handleDataRef.current = onData;

  const localEchoRef = useRef(localEcho);
  localEchoRef.current = localEcho;

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: buildXtermTheme(),
      disableStdin: readonly ?? false,
      convertEol: true,
      lineHeight: 1.2,
      letterSpacing: 0,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.open(containerRef.current);

    const safeFit = () => {
      if (
        !containerRef.current || 
        containerRef.current.clientWidth === 0 || 
        containerRef.current.clientHeight === 0
      ) {
        return;
      }
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('xterm.js fit() failed:', e);
      }
    };

    safeFit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Dynamic theme sync — re-read CSS vars when data-theme or dark class changes
    const root = document.documentElement;
    const updateTheme = () => {
      terminal.options.theme = buildXtermTheme();
      // Force a redraw so the new colours are applied immediately
      terminal.refresh(0, terminal.rows - 1);
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    // Write initial lines (history) if provided
    if (initialLines && initialLines.length > 0) {
      for (const line of initialLines) {
        terminal.write(line);
      }
      initialWrittenRef.current = true;
    }

    // Notify parent that terminal is ready
    onReady?.(terminal);

    if (!readonly) {
      terminal.onData((data) => {
        if (localEchoRef.current) {
          for (const ch of data) {
            if (ch === '\r') {
              terminal.write('\r\n');
            } else if (ch === '\x7f' || ch === '\b') {
              terminal.write('\b \b');
            } else if (ch >= ' ') {
              terminal.write(ch);
            }
          }
        }
        handleDataRef.current?.(data);
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      initialWrittenRef.current = false;
    };
    // initialLines intentionally excluded — only used on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readonly, onReady]);

  useEffect(() => {
    if (initialWrittenRef.current) return;
    if (!terminalRef.current) return;
    if (!initialLines || initialLines.length === 0) return;
    for (const line of initialLines) {
      terminalRef.current.write(line);
    }
    initialWrittenRef.current = true;
  }, [initialLines]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} style={{ minHeight: 200, overflow: 'hidden', zIndex: 0 }} />;
});

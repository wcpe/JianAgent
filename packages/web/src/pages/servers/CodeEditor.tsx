import { useRef, useEffect } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, StreamLanguage } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';

// ── Properties / INI language (StreamLanguage) ──

const propertiesLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol() && stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.sol() && stream.peek() === '!') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.sol() && stream.peek() === '[') {
      stream.skipToEnd();
      return 'heading';
    }
    if (stream.sol()) {
      // Key part — read until = or :
      if (stream.match(/^[^=:\s]+/)) return 'propertyName';
    }
    if (stream.eat('=') || stream.eat(':')) return 'punctuation';
    stream.next();
    return 'string';
  },
});

// ── TOML-like language (basic) ──

const tomlLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol() && stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.sol() && stream.match(/^\[+[^\]]*\]+/)) return 'heading';
    if (stream.sol() && stream.match(/^[a-zA-Z0-9_.-]+/)) return 'propertyName';
    if (stream.eat('=')) return 'punctuation';
    if (stream.match(/^"[^"]*"/)) return 'string';
    if (stream.match(/^'[^']*'/)) return 'string';
    if (stream.match(/^(true|false)\b/)) return 'bool';
    if (stream.match(/^-?\d[\d_]*(\.\d[\d_]*)?/)) return 'number';
    stream.next();
    return null;
  },
});

// ── Minecraft config completions ──

const MC_YAML_KEYS = [
  'server-port', 'server-ip', 'online-mode', 'max-players', 'view-distance',
  'simulation-distance', 'difficulty', 'gamemode', 'level-name', 'level-seed',
  'level-type', 'spawn-protection', 'allow-nether', 'allow-flight',
  'white-list', 'enforce-whitelist', 'motd', 'pvp', 'spawn-npcs',
  'spawn-animals', 'spawn-monsters', 'generate-structures', 'max-world-size',
  'network-compression-threshold', 'enable-command-block', 'op-permission-level',
  'player-idle-timeout', 'rate-limit', 'max-tick-time',
  // Paper-specific
  'max-auto-save-chunks-per-tick', 'prevent-moving-into-unloaded-chunks',
  'use-faster-eigencraft-redstone', 'fix-climbing-bypassing-cramming-rule',
  'armor-stands-tick', 'per-player-mob-spawns', 'alt-item-despawn-rate',
  'anti-xray', 'engine-mode', 'max-block-state-chunk-section',
].map((key) => ({ label: key, type: 'property' }));

const MC_PROPERTIES_KEYS = [
  'server-port', 'server-ip', 'online-mode', 'max-players', 'view-distance',
  'difficulty', 'gamemode', 'level-name', 'level-seed', 'level-type',
  'spawn-protection', 'allow-nether', 'allow-flight', 'white-list', 'motd',
  'pvp', 'query.port', 'rcon.port', 'rcon.password', 'enable-rcon',
  'enable-query', 'resource-pack', 'resource-pack-sha1',
].map((key) => ({ label: key, type: 'property' }));

function mcCompletions(filename: string) {
  const ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.yml' || ext === '.yaml') {
    return autocompletion({
      override: [
        (ctx) => {
          const word = ctx.matchBefore(/[\w-]*/);
          if (!word || (word.from === word.to && !ctx.explicit)) return null;
          return { from: word.from, options: MC_YAML_KEYS, validFor: /^[\w-]*$/ };
        },
      ],
    });
  }
  if (ext === '.properties') {
    return autocompletion({
      override: [
        (ctx) => {
          const word = ctx.matchBefore(/[\w.-]*/);
          if (!word || (word.from === word.to && !ctx.explicit)) return null;
          return { from: word.from, options: MC_PROPERTIES_KEYS, validFor: /^[\w.-]*$/ };
        },
      ],
    });
  }
  return autocompletion();
}

// ── Language Extension Selector ──

interface CodeEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly filename: string;
  readonly darkMode?: boolean;
}

function getLanguageExtension(filename: string): Extension {
  const ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  switch (ext) {
    case '.json': return json();
    case '.xml': return xml();
    case '.yml':
    case '.yaml': return yaml();
    case '.properties':
    case '.cfg':
    case '.ini':
    case '.conf': return propertiesLanguage;
    case '.toml': return tomlLanguage;
    default: return [];
  }
}

export function CodeEditor({ value, onChange, filename, darkMode }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isDark = darkMode ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      highlightSelectionMatches(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      history(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      getLanguageExtension(filename),
      mcCompletions(filename),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px', borderRadius: '12px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace" },
        '.cm-tooltip.cm-tooltip-autocomplete': { maxHeight: '200px' },
      }),
    ];

    if (isDark) {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate editor when filename changes (language mode); value is set on creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, isDark]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

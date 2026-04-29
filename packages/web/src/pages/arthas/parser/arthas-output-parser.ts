import type { DiagnosticsEvent, ParsedDiagnosticsView } from '../types/diagnostics-view.js';

function tryParseJson(output: string): unknown | null {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function pickVersionFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as {
    version?: unknown;
    results?: Array<Record<string, unknown>>;
  };

  if (typeof record.version === 'string') return record.version;

  const versionResult = record.results?.find((item) => item?.type === 'version');
  const value = versionResult?.version;
  return typeof value === 'string' ? value : undefined;
}

export function parseArthasOutput(command: string, output: string): ParsedDiagnosticsView {
  const trimmedCommand = command.trim().toLowerCase();
  const json = tryParseJson(output);

  if (trimmedCommand.startsWith('version') && json) {
    const version = pickVersionFromPayload(json);
    return {
      type: 'version',
      data: { version, payload: json },
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('dashboard') && json) {
    return {
      type: 'dashboard',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('thread') && json) {
    // Extract thread data from results array
    const payload = json as { results?: Array<Record<string, unknown>> };
    const threadResult = payload.results?.find((item) => item?.type === 'thread');
    return {
      type: 'thread',
      data: threadResult || json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('jvm') && json) {
    // Extract jvm data from results array
    const payload = json as { results?: Array<Record<string, unknown>> };
    const jvmResult = payload.results?.find((item) => item?.type === 'jvm');
    // Extract jvmInfo from the result
    const jvmInfo = jvmResult && typeof jvmResult === 'object' && 'jvmInfo' in jvmResult 
      ? jvmResult.jvmInfo 
      : jvmResult || json;
    return {
      type: 'jvm',
      data: jvmInfo,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('sc') && json) {
    return {
      type: 'sc',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('sm') && json) {
    return {
      type: 'sm',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('jad') && json) {
    return {
      type: 'jad',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('watch') && json) {
    return {
      type: 'watch',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('trace') && json) {
    return {
      type: 'trace',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('stack') && json) {
    return {
      type: 'stack',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('tt') && json) {
    return {
      type: 'tt',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('monitor') && json) {
    return {
      type: 'monitor',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('profiler') && json) {
    return {
      type: 'profiler',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('heapdump') && json) {
    return {
      type: 'heapdump',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('memory') && json) {
    return {
      type: 'memory',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('sysprop') && json) {
    return {
      type: 'sysprop',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('sysenv') && json) {
    return {
      type: 'sysenv',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('vmoption') && json) {
    return {
      type: 'vmoption',
      data: json,
      raw: output,
    };
  }

  if (trimmedCommand.startsWith('logger') && json) {
    return {
      type: 'logger',
      data: json,
      raw: output,
    };
  }

  return {
    type: 'raw',
    raw: output,
  };
}

export function buildDiagnosticsEvent(command: string, output: string, ts = Date.now()): DiagnosticsEvent {
  const view = parseArthasOutput(command, output);

  if (view.type === 'raw') {
    return {
      kind: 'raw',
      text: output,
      ts,
    };
  }

  return {
    kind: 'structured',
    payload: view,
    ts,
  };
}

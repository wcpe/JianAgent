import { describe, expect, test } from 'vitest';
import { buildDiagnosticsEvent } from '../parser/arthas-output-parser.js';

describe('arthas split integration event builder', () => {
  test('version 命令构建 structured 事件', () => {
    const output = '{"command":"version","results":[{"type":"version","version":"4.1.8"}]}';
    const event = buildDiagnosticsEvent('version', output, 100);

    expect(event.kind).toBe('structured');
    if (event.kind === 'structured') {
      expect(event.payload.type).toBe('version');
    }
  });

  test('普通输出构建 raw 事件', () => {
    const event = buildDiagnosticsEvent('foo', 'bar', 101);
    expect(event.kind).toBe('raw');
  });
});

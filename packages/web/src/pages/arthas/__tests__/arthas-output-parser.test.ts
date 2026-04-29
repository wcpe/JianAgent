import { describe, expect, test } from 'vitest';
import { parseArthasOutput } from '../parser/arthas-output-parser.js';

describe('parseArthasOutput', () => {
  test('可识别 version JSON 结果', () => {
    const text = '{"command":"version","results":[{"type":"version","version":"4.1.8"}]}';
    const parsed = parseArthasOutput('version', text);

    expect(parsed.type).toBe('version');
    expect((parsed.data as { version?: string }).version).toBe('4.1.8');
  });

  test('dashboard 解析失败时 fallback 为 raw', () => {
    const text = 'dashboard output text';
    const parsed = parseArthasOutput('dashboard', text);

    expect(parsed.type).toBe('raw');
    expect(parsed.raw).toContain('dashboard');
  });
});

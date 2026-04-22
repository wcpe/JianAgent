import { describe, it, expect } from 'vitest';
import { colorizeLine, colorizeOutput } from '../log-colorizer.js';

describe('log-colorizer', () => {
  describe('colorizeLine', () => {
    it('should return raw line when format does not match', () => {
      const raw = 'some random text';
      expect(colorizeLine(raw)).toBe(raw);
    });

    it('should colorize a standard INFO log line', () => {
      const raw = '[12:34:56 INFO]: Server started';
      const result = colorizeLine(raw);
      expect(result).toContain('12:34:56');
      expect(result).toContain('INFO');
      expect(result).toContain('Server started');
      // Should contain ANSI reset
      expect(result).toContain('\x1b[0m');
      // Should contain cyan for INFO
      expect(result).toContain('\x1b[36m');
    });

    it('should colorize ERROR level in red', () => {
      const raw = '[12:34:56 ERROR]: Something went wrong';
      const result = colorizeLine(raw);
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('ERROR');
    });

    it('should colorize WARN level in yellow', () => {
      const raw = '[12:34:56 WARN]: Low memory';
      const result = colorizeLine(raw);
      expect(result).toContain('\x1b[33m');
    });

    it('should colorize FATAL level in bold red', () => {
      const raw = '[12:34:56 FATAL]: Critical failure';
      const result = colorizeLine(raw);
      expect(result).toContain('\x1b[1;31m');
    });

    it('should highlight plugin names in magenta', () => {
      const raw = '[12:34:56 INFO]: [MyPlugin] something happened';
      const result = colorizeLine(raw);
      expect(result).toContain('\x1b[35m'); // magenta for plugin
      expect(result).toContain('MyPlugin');
    });

    it('should handle multiple plugin names in one line', () => {
      const raw = '[12:34:56 INFO]: [PluginA] loaded [PluginB] dependency';
      const result = colorizeLine(raw);
      // Both should be colorized
      expect(result).toContain('PluginA');
      expect(result).toContain('PluginB');
    });

    it('should colorize timestamp in gray', () => {
      const raw = '[12:34:56 INFO]: test';
      const result = colorizeLine(raw);
      expect(result).toContain('\x1b[90m'); // gray for timestamp
    });
  });

  describe('colorizeOutput', () => {
    it('should process multi-line text', () => {
      const input = [
        '[12:00:00 INFO]: First line',
        'plain text',
        '[12:00:01 ERROR]: Error line',
      ].join('\n');

      const result = colorizeOutput(input);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      // First line should be colorized
      expect(lines[0]).toContain('\x1b[36m'); // INFO cyan
      // Second line should be unchanged
      expect(lines[1]).toBe('plain text');
      // Third line should be colorized
      expect(lines[2]).toContain('\x1b[31m'); // ERROR red
    });

    it('should handle empty string', () => {
      expect(colorizeOutput('')).toBe('');
    });
  });
});

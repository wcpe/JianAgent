import { describe, it, expect } from 'vitest';
import { parseLogLine, stripAnsi, matchesFilters } from '../log-line-parser.js';

describe('log-line-parser', () => {
  describe('stripAnsi', () => {
    it('should remove ANSI color codes', () => {
      expect(stripAnsi('\x1b[31mERROR\x1b[0m')).toBe('ERROR');
    });

    it('should handle text with no ANSI codes', () => {
      expect(stripAnsi('plain text')).toBe('plain text');
    });

    it('should remove multiple ANSI sequences', () => {
      expect(stripAnsi('\x1b[1;31mBOLD RED\x1b[0m normal \x1b[90mgray\x1b[0m')).toBe(
        'BOLD RED normal gray',
      );
    });
  });

  describe('parseLogLine - Minecraft format', () => {
    it('should parse a standard MC INFO line', () => {
      const result = parseLogLine('[12:34:56 INFO]: Server started');
      expect(result.timestamp).toBe('12:34:56');
      expect(result.level).toBe('INFO');
      expect(result.message).toBe('Server started');
      expect(result.raw).toBe('[12:34:56 INFO]: Server started');
      expect(result.source).toBeUndefined();
    });

    it('should parse MC ERROR line', () => {
      const result = parseLogLine('[09:00:01 ERROR]: Something went wrong');
      expect(result.level).toBe('ERROR');
      expect(result.message).toBe('Something went wrong');
    });

    it('should parse MC WARN line', () => {
      const result = parseLogLine('[09:00:01 WARN]: Low memory');
      expect(result.level).toBe('WARN');
    });

    it('should parse MC FATAL line', () => {
      const result = parseLogLine('[09:00:01 FATAL]: Critical failure');
      expect(result.level).toBe('FATAL');
    });

    it('should parse MC DEBUG line', () => {
      const result = parseLogLine('[09:00:01 DEBUG]: Debug info');
      expect(result.level).toBe('DEBUG');
    });

    it('should parse MC TRACE line', () => {
      const result = parseLogLine('[09:00:01 TRACE]: Trace data');
      expect(result.level).toBe('TRACE');
    });
  });

  describe('parseLogLine - NestJS format', () => {
    it('should parse a NestJS log line', () => {
      const raw = '[Nest] 12345  - 04/23/2026, 2:15:30 PM     LOG [BootstrapService] Started';
      const result = parseLogLine(raw);
      expect(result.timestamp).toBe('04/23/2026, 2:15:30 PM');
      expect(result.level).toBe('INFO'); // LOG -> INFO
      expect(result.source).toBe('BootstrapService');
      expect(result.message).toBe('Started');
      expect(result.raw).toBe(raw);
    });

    it('should parse NestJS ERROR line', () => {
      const raw = '[Nest] 999  - 01/01/2026, 8:00:00 AM     ERROR [ExceptionFilter] Unhandled error';
      const result = parseLogLine(raw);
      expect(result.level).toBe('ERROR');
      expect(result.source).toBe('ExceptionFilter');
      expect(result.message).toBe('Unhandled error');
    });

    it('should parse NestJS line with ANSI codes', () => {
      const raw = '\x1b[32m[Nest] 12345  - 04/23/2026, 2:15:30 PM     LOG [Bootstrap] OK\x1b[0m';
      const result = parseLogLine(raw);
      expect(result.level).toBe('INFO');
      expect(result.source).toBe('Bootstrap');
      expect(result.message).toBe('OK');
    });

    it('should parse NestJS VERBOSE as DEBUG', () => {
      const raw = '[Nest] 1  - 01/01/2026, 1:00:00 AM     VERBOSE [RouterExplorer] Mapped route';
      const result = parseLogLine(raw);
      expect(result.level).toBe('DEBUG');
    });
  });

  describe('parseLogLine - level normalization', () => {
    it('should normalize LOG to INFO via NestJS pattern', () => {
      const raw = '[Nest] 1  - 01/01/2026, 1:00:00 AM     LOG [App] init';
      expect(parseLogLine(raw).level).toBe('INFO');
    });

    it('should normalize VERBOSE to DEBUG via NestJS pattern', () => {
      const raw = '[Nest] 1  - 01/01/2026, 1:00:00 AM     VERBOSE [App] detail';
      expect(parseLogLine(raw).level).toBe('DEBUG');
    });
  });

  describe('parseLogLine - fallback', () => {
    it('should return INFO for unrecognized lines', () => {
      const raw = 'some random log text';
      const result = parseLogLine(raw);
      expect(result.level).toBe('INFO');
      expect(result.message).toBe('some random log text');
      expect(result.timestamp).toBe('');
      expect(result.raw).toBe(raw);
    });

    it('should strip ANSI from fallback message', () => {
      const raw = '\x1b[33mwarning text\x1b[0m';
      const result = parseLogLine(raw);
      expect(result.message).toBe('warning text');
    });
  });

  describe('matchesFilters', () => {
    const entry = parseLogLine('[12:00:00 ERROR]: Connection refused');

    it('should match when no filters set', () => {
      expect(matchesFilters(entry, {})).toBe(true);
    });

    it('should match when level is in the levels array', () => {
      expect(matchesFilters(entry, { levels: ['ERROR', 'WARN'] })).toBe(true);
    });

    it('should not match when level is not in the levels array', () => {
      expect(matchesFilters(entry, { levels: ['INFO'] })).toBe(false);
    });

    it('should match with empty levels array (means all)', () => {
      expect(matchesFilters(entry, { levels: [] })).toBe(true);
    });

    it('should match keyword case-insensitively', () => {
      expect(matchesFilters(entry, { keyword: 'connection' })).toBe(true);
      expect(matchesFilters(entry, { keyword: 'CONNECTION' })).toBe(true);
      expect(matchesFilters(entry, { keyword: 'Connection Refused' })).toBe(true);
    });

    it('should not match when keyword is absent from message', () => {
      expect(matchesFilters(entry, { keyword: 'timeout' })).toBe(false);
    });

    it('should combine level and keyword filters', () => {
      expect(matchesFilters(entry, { levels: ['ERROR'], keyword: 'refused' })).toBe(true);
      expect(matchesFilters(entry, { levels: ['INFO'], keyword: 'refused' })).toBe(false);
      expect(matchesFilters(entry, { levels: ['ERROR'], keyword: 'timeout' })).toBe(false);
    });

    it('should match keyword against raw line', () => {
      const e = parseLogLine('[12:00:00 WARN]: [MyPlugin] tick lag');
      expect(matchesFilters(e, { keyword: 'MyPlugin' })).toBe(true);
    });
  });
});

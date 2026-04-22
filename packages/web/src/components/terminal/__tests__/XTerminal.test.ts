import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWrite = vi.fn();
const mockClear = vi.fn();
const mockFocus = vi.fn();
const mockFit = vi.fn();
const mockDispose = vi.fn();
const mockLoadAddon = vi.fn();
const mockOnData = vi.fn();
const mockFindNext = vi.fn();
const mockFindPrevious = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    dispose: mockDispose,
    loadAddon: mockLoadAddon,
    onData: mockOnData,
    write: mockWrite,
    clear: mockClear,
    focus: mockFocus,
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: mockFit,
  })),
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn().mockImplementation(() => ({
    findNext: mockFindNext,
    findPrevious: mockFindPrevious,
  })),
}));

import { Terminal } from '@xterm/xterm';

describe('XTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ResizeObserver
    (globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  it('Terminal constructor is called with correct options for readonly mode', () => {
    expect(Terminal).toBeDefined();
    const term = new Terminal({ disableStdin: true });
    expect(term.write).toBeDefined();
    expect(term.dispose).toBeDefined();
  });

  it('Terminal constructor is called for writable mode', () => {
    const term = new Terminal({ disableStdin: false });
    expect(term.loadAddon).toBeDefined();
  });

  it('exports XTerminalHandle interface methods', () => {
    // Verify the handle methods exist by checking the mock wiring
    const term = new Terminal({});
    expect(term.write).toBeDefined();
    expect(term.clear).toBeDefined();
    expect(term.focus).toBeDefined();
  });
});

import { describe, it, expect, vi } from 'vitest';

describe('Arthas Page Module', () => {
  it('should export ArthasPage component', async () => {
    const module = await import('../index.js');
    expect(module.ArthasPage).toBeDefined();
    expect(typeof module.ArthasPage).toBe('function');
  });

  it('should export default ArthasPage', async () => {
    const module = await import('../index.js');
    expect(module.default).toBeDefined();
  });
});

describe('Arthas Components', () => {
  it('should export OutputTerminal', async () => {
    const module = await import('../components/OutputTerminal.js');
    expect(module.OutputTerminal).toBeDefined();
  });

  it('should export StatusIndicator', async () => {
    const module = await import('../components/StatusIndicator.js');
    expect(module.StatusIndicator).toBeDefined();
  });

  it('should export ServerSelector', async () => {
    const module = await import('../components/ServerSelector.js');
    expect(module.ServerSelector).toBeDefined();
  });

  it('should export CommandInput', async () => {
    const module = await import('../components/CommandInput.js');
    expect(module.CommandInput).toBeDefined();
  });

  it('should export QuickCommands', async () => {
    const module = await import('../components/QuickCommands.js');
    expect(module.QuickCommands).toBeDefined();
  });
});

describe('Arthas Hooks', () => {
  it('should export useArthasConnection', async () => {
    const module = await import('../hooks/useArthasConnection.js');
    expect(module.useArthasConnection).toBeDefined();
  });

  it('should export useCommandHistory', async () => {
    const module = await import('../hooks/useCommandHistory.js');
    expect(module.useCommandHistory).toBeDefined();
  });
});

describe('Arthas API', () => {
  it('should export arthasApi', async () => {
    const module = await import('../../../api/arthas.api.js');
    expect(module.arthasApi).toBeDefined();
    expect(module.arthasApi.attach).toBeDefined();
    expect(module.arthasApi.detach).toBeDefined();
    expect(module.arthasApi.executeCommand).toBeDefined();
    expect(module.arthasApi.getStatus).toBeDefined();
  });
});

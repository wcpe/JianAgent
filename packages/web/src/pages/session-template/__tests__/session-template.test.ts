import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../api/session-template.api.js', () => ({
  sessionTemplateApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: [{ id: 't1', name: 'Test', description: '', botConfig: '{}', phases: '[]', createdAt: '2024-01-01', updatedAt: '2024-01-01' }] }),
    create: vi.fn().mockResolvedValue({ success: true, data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    createSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

describe('SessionTemplatePage', () => {
  it('should export the component', async () => {
    const mod = await import('../SessionTemplatePage.js');
    expect(mod.SessionTemplatePage).toBeDefined();
  });
});

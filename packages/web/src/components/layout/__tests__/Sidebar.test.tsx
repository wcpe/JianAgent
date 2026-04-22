/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar.js';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../stores/auth.store.js', () => ({
  useAuthStore: (selector: (state: { logout: typeof mockLogout }) => unknown) =>
    selector({ logout: mockLogout }),
}));

vi.mock('../../stores/theme.store.js', () => ({
  useThemeStore: (selector: (state: any) => unknown) =>
    selector({
      sidebarCollapsed: false,
      sidebarFloating: false,
      toggleSidebar: vi.fn(),
      toggleSidebarFloating: vi.fn(),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: vi.fn(),
    }),
}));

vi.mock('../ThemeToggle.js', () => ({
  ThemeToggle: () => <div>theme-toggle</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('highlights only session compare on /sessions/compare', () => {
    render(
      <MemoryRouter initialEntries={['/sessions/compare']}>
        <Sidebar />
      </MemoryRouter>,
    );

    const sessionCompareLink = screen.getByRole('link', { name: '会话对比' });
    const sessionsLink = screen.getByRole('link', { name: '压测会话' });

    expect(sessionCompareLink.className).toContain('bg-primary-600');
    expect(sessionsLink.className).not.toContain('bg-primary-600');
  });

  it('highlights node log on /node-log', () => {
    render(
      <MemoryRouter initialEntries={['/node-log']}>
        <Sidebar />
      </MemoryRouter>,
    );

    const nodeLogLink = screen.getAllByRole('link', { name: 'Node Log' })
      .find((link) => link.className.includes('bg-primary-600'));
    const terminalsLink = screen.getAllByRole('link', { name: '终端' })[0];

    expect(nodeLogLink).toBeTruthy();
    expect(nodeLogLink?.className).toContain('bg-primary-600');
    expect(terminalsLink?.className).not.toContain('bg-primary-600');
  });
});

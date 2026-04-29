/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../AppLayout.js';
import * as serverApi from '../../../api/server.api.js';

// Mock API
vi.mock('../../../api/server.api.js', () => ({
  serverApi: {
    listServers: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../theme/theme-runtime.js', () => ({
  applyTheme: vi.fn(),
  watchSystemScheme: vi.fn(() => () => {}),
}));

// Mock components
vi.mock('../Sidebar.js', () => ({
  Sidebar: () => <div data-testid="global-sidebar">Sidebar</div>,
}));

vi.mock('../ResourceSidebar.js', () => ({
  ResourceSidebar: () => <div data-testid="resource-sidebar">ResourceSidebar</div>,
}));

vi.mock('../TopStatusBar.js', () => ({
  TopStatusBar: () => <div data-testid="top-status-bar">TopStatusBar</div>,
}));

vi.mock('../status/AlertBanner.js', () => ({
  AlertBanner: () => <div data-testid="alert-banner">AlertBanner</div>,
}));

vi.mock('../WsStatusBanner.js', () => ({
  WsStatusBanner: () => <div data-testid="ws-status-banner">WsStatusBanner</div>,
}));

vi.mock('../ui/ToastContainer.js', () => ({
  ToastContainer: () => <div data-testid="toast-container">ToastContainer</div>,
}));

vi.mock('../ui/ConfirmDialog.js', () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog">ConfirmDialog</div>,
}));

vi.mock('../ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AppLayout - fetchServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call fetchServers (via API) on mount', async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    // Wait for the API call to be made
    await waitFor(() => {
      expect(serverApi.serverApi.listServers).toHaveBeenCalledTimes(1);
    });
  });

  it('should only call fetchServers once on mount, not on every re-render', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(serverApi.serverApi.listServers).toHaveBeenCalledTimes(1);
    });

    // Re-render
    rerender(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    // Should still be called only once (not twice)
    expect(serverApi.serverApi.listServers).toHaveBeenCalledTimes(1);
  });
});

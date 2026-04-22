/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogCenterPage } from '../LogCenterPage.js';

const { mockRecent, mockSearch, mockAnalytics } = vi.hoisted(() => ({
  mockRecent: vi.fn(),
  mockSearch: vi.fn(),
  mockAnalytics: vi.fn(),
}));

vi.mock('../../../api/log-center.api.js', () => ({
  logCenterApi: {
    recent: mockRecent,
    search: mockSearch,
    analytics: mockAnalytics,
  },
}));

vi.mock('../LogSearchBar.js', () => ({
  LogSearchBar: ({ onSearch }: { onSearch: () => void }) => (
    <button type="button" onClick={onSearch}>search</button>
  ),
}));

vi.mock('../LogAnalyticsPanel.js', () => ({
  LogAnalyticsPanel: () => <div>analytics-panel</div>,
}));

describe('LogCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecent.mockResolvedValue({
      entries: [
        { serverId: 'srv-1', file: 'latest.log', line: 1, content: 'recent line' },
      ],
      backend: 'local-file',
      degraded: false,
    });
    mockSearch.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      limit: 50,
      highlightMap: new Map(),
    });
    mockAnalytics.mockResolvedValue({
      levelDistribution: { INFO: 1 },
      timelineBuckets: [],
      topKeywords: [],
    });
  });

  it('loads recent logs on mount when keyword is blank', async () => {
    render(<LogCenterPage />);

    await waitFor(() => {
      expect(mockRecent).toHaveBeenCalled();
      expect(mockAnalytics).toHaveBeenCalled();
    });

    expect(await screen.findByText('recent line')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JvmObservabilityPage } from '../JvmObservabilityPage.js';

const {
  mockListServers,
  mockListJavaProcesses,
  mockCollectJmx,
  mockGetJmxLatest,
  mockGetJmxHistoryAggregated,
  mockListJmxSchedules,
  mockGetOverview,
  mockListJfrTasks,
} = vi.hoisted(() => ({
  mockListServers: vi.fn(),
  mockListJavaProcesses: vi.fn(),
  mockCollectJmx: vi.fn(),
  mockGetJmxLatest: vi.fn(),
  mockGetJmxHistoryAggregated: vi.fn(),
  mockListJmxSchedules: vi.fn(),
  mockGetOverview: vi.fn(),
  mockListJfrTasks: vi.fn(),
}));

vi.mock('../../../api/server.api.js', () => ({
  serverApi: {
    listServers: mockListServers,
    listJavaProcesses: mockListJavaProcesses,
  },
}));

vi.mock('../../../api/metrics.api.js', () => ({
  metricsApi: {
    collectJmx: mockCollectJmx,
    getJmxLatest: mockGetJmxLatest,
    getJmxHistoryAggregated: mockGetJmxHistoryAggregated,
    listJmxSchedules: mockListJmxSchedules,
    getOverview: mockGetOverview,
    createJmxSchedule: vi.fn().mockResolvedValue(undefined),
    removeJmxSchedule: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../api/java-helper.api.js', () => ({
  javaHelperApi: {
    listJfrTasks: mockListJfrTasks,
    startJfr: vi.fn().mockResolvedValue(undefined),
    stopJfr: vi.fn().mockResolvedValue(undefined),
    downloadJfrStream: vi.fn().mockResolvedValue(new Blob()),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('JvmObservabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListServers.mockResolvedValue([{ id: 'srv-1', name: 'Server One' }]);
    mockListJavaProcesses.mockResolvedValue({
      success: true,
      data: [{ pid: 4242, command: 'java -jar paper.jar' }],
    });
    mockCollectJmx.mockResolvedValue(undefined);
    mockGetJmxLatest.mockResolvedValue(null);
    mockGetJmxHistoryAggregated.mockResolvedValue([]);
    mockListJmxSchedules.mockResolvedValue([]);
    mockGetOverview.mockResolvedValue(null);
    mockListJfrTasks.mockResolvedValue({ data: [] });
  });

  it('loads local JVM processes and selects pid into the form', async () => {
    render(<JvmObservabilityPage />);

    expect(await screen.findByText('PID 4242')).toBeTruthy();

    const processButton = screen.getByText('PID 4242').closest('button');
    expect(processButton).toBeTruthy();
    fireEvent.click(processButton!);

    await waitFor(() => {
      expect((screen.getByPlaceholderText('pid') as HTMLInputElement).value).toBe('4242');
    });

    expect((screen.getByRole('button', { name: '手动采集 JMX' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

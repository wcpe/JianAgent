import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FloatingDashboard } from '../FloatingDashboard.js';
import { arthasApi } from '../../../../api/arthas.api.js';

vi.mock('../../../../api/arthas.api.js', () => ({
  arthasApi: {
    executeCommand: vi.fn(),
  },
}));

describe('FloatingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when not connected', () => {
    const { container } = render(
      <FloatingDashboard serverId={null} isConnected={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render collapsed button when connected', () => {
    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    expect(button).toBeInTheDocument();
  });

  it('should expand panel when button clicked', async () => {
    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('实时监控')).toBeInTheDocument();
    });
  });

  it('should fetch dashboard data when expanded', async () => {
    const mockOutput = `
      thread-count: 42
      peak-thread-count: 50
      daemon-thread-count: 10
      heap-memory-usage used: 512M
      heap-memory-usage max: 1024M
      non-heap-memory-usage used: 128M
      gc-count: 5
      gc-time: 100
      cpu: 25.5%
      system-load: 1.5
      uptime: 3600
    `;

    vi.mocked(arthasApi.executeCommand).mockResolvedValue({
      success: true,
      output: mockOutput,
      executionTime: 100,
    });

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(arthasApi.executeCommand).toHaveBeenCalledWith('test-server', 'dashboard -n 1');
    });

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument(); // thread count
    });
  });

  it('should auto-refresh data every 2 seconds', async () => {
    vi.mocked(arthasApi.executeCommand).mockResolvedValue({
      success: true,
      output: 'thread-count: 42',
      executionTime: 100,
    });

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(arthasApi.executeCommand).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(arthasApi.executeCommand).toHaveBeenCalledTimes(2);
    });

    // Fast-forward another 2 seconds
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(arthasApi.executeCommand).toHaveBeenCalledTimes(3);
    });
  });

  it('should stop refreshing when collapsed', async () => {
    vi.mocked(arthasApi.executeCommand).mockResolvedValue({
      success: true,
      output: 'thread-count: 42',
      executionTime: 100,
    });

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    // Expand
    const expandButton = screen.getByTitle('打开实时监控');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(arthasApi.executeCommand).toHaveBeenCalledTimes(1);
    });

    // Collapse
    const collapseButton = screen.getByTitle('收起');
    fireEvent.click(collapseButton);

    // Fast-forward time
    vi.advanceTimersByTime(10000);

    // Should not call API again
    expect(arthasApi.executeCommand).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    vi.mocked(arthasApi.executeCommand).mockRejectedValue(new Error('Network error'));

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('正在加载监控数据...')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should parse memory values with different units', async () => {
    const mockOutput = `
      heap-memory-usage used: 1.5G
      heap-memory-usage max: 2G
      non-heap-memory-usage used: 256M
    `;

    vi.mocked(arthasApi.executeCommand).mockResolvedValue({
      success: true,
      output: mockOutput,
      executionTime: 100,
    });

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/1\.5 GB/)).toBeInTheDocument();
      expect(screen.getByText(/2\.0 GB/)).toBeInTheDocument();
      expect(screen.getByText(/256\.0 MB/)).toBeInTheDocument();
    });
  });

  it('should display memory usage percentage with color coding', async () => {
    const mockOutput = `
      heap-memory-usage used: 950M
      heap-memory-usage max: 1000M
    `;

    vi.mocked(arthasApi.executeCommand).mockResolvedValue({
      success: true,
      output: mockOutput,
      executionTime: 100,
    });

    render(<FloatingDashboard serverId="test-server" isConnected={true} />);
    
    const button = screen.getByTitle('打开实时监控');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('95.0%')).toBeInTheDocument();
    });
  });
});

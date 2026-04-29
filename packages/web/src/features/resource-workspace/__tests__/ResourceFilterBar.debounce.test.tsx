/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceFilterBar } from '../ResourceFilterBar.js';
import type { ResourceWorkspaceFilters } from '../resource-workspace.store.js';

describe('ResourceFilterBar - 防抖行为', () => {
  const mockOnSetFilters = vi.fn();
  const mockOnSetViewMode = vi.fn();
  const mockOnBatchAction = vi.fn();
  const mockOnClearSelection = vi.fn();

  const defaultProps = {
    filters: {} as ResourceWorkspaceFilters,
    viewMode: 'card' as const,
    selectedServerCount: 0,
    error: null,
    onSetFilters: mockOnSetFilters,
    onSetViewMode: mockOnSetViewMode,
    onBatchAction: mockOnBatchAction,
    onClearSelection: mockOnClearSelection,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('搜索框应该在 400ms 后触发 onSetFilters', async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/搜索名称/);
    await user.type(searchInput, 'test');

    // 立即检查，不应该触发
    expect(mockOnSetFilters).not.toHaveBeenCalled();

    // 等待防抖时间
    await waitFor(
      () => {
        expect(mockOnSetFilters).toHaveBeenCalledWith({ q: 'test' });
      },
      { timeout: 1000 }
    );
  });

  it('分组输入应该在 400ms 后触发 onSetFilters', async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...defaultProps} />);

    const groupInput = screen.getByPlaceholderText('分组');
    await user.type(groupInput, 'prod');

    expect(mockOnSetFilters).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockOnSetFilters).toHaveBeenCalledWith({ group: 'prod' });
      },
      { timeout: 1000 }
    );
  });

  it('标签输入应该在 400ms 后触发 onSetFilters', async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...defaultProps} />);

    const tagInput = screen.getByPlaceholderText('标签');
    await user.type(tagInput, 'important');

    expect(mockOnSetFilters).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockOnSetFilters).toHaveBeenCalledWith({ tag: 'important' });
      },
      { timeout: 1000 }
    );
  });

  it('快速连续输入应该只触发最后一次', async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/搜索名称/);

    // 快速输入多个字符
    await user.type(searchInput, 'test');

    // 等待防抖完成
    await waitFor(
      () => {
        expect(mockOnSetFilters).toHaveBeenCalledWith({ q: 'test' });
      },
      { timeout: 1000 }
    );

    // 应该只触发一次（因为防抖）
    expect(mockOnSetFilters).toHaveBeenCalledTimes(1);
  });

  it('下拉选择器应该立即触发（不防抖）', async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...defaultProps} />);

    const kindSelect = screen.getByDisplayValue('全部资源');
    await user.selectOptions(kindSelect, 'SERVER');

    // 下拉选择应该立即触发，不需要等待
    expect(mockOnSetFilters).toHaveBeenCalledWith({
      kind: 'SERVER',
      serverType: undefined,
    });
  });

  it('清空搜索框应该在 400ms 后触发', async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        {...defaultProps}
        filters={{ q: 'test' } as ResourceWorkspaceFilters}
      />
    );

    const searchInput = screen.getByPlaceholderText(/搜索名称/);
    await user.clear(searchInput);

    expect(mockOnSetFilters).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockOnSetFilters).toHaveBeenCalledWith({ q: undefined });
      },
      { timeout: 1000 }
    );
  });
});

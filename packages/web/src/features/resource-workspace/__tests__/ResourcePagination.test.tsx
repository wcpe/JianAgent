import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourcePagination } from '../components/ResourcePagination.js';

describe('ResourcePagination', () => {
  it('应该渲染分页控件', () => {
    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('应该在第一页时禁用上一页按钮', () => {
    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    const prevButton = screen.getByLabelText('上一页');
    expect(prevButton).toBeDisabled();
  });

  it('应该在最后一页时禁用下一页按钮', () => {
    render(
      <ResourcePagination
        page={3}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    const nextButton = screen.getByLabelText('下一页');
    expect(nextButton).toBeDisabled();
  });

  it('应该在点击下一页时触发 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    );

    const nextButton = screen.getByLabelText('下一页');
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('应该在点击上一页时触发 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <ResourcePagination
        page={2}
        limit={20}
        total={45}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    );

    const prevButton = screen.getByLabelText('上一页');
    await user.click(prevButton);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('应该在点击页码时触发 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    );

    const page2Button = screen.getByText('2');
    await user.click(page2Button);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('应该在切换每页数量时触发 onLimitChange', async () => {
    const user = userEvent.setup();
    const onLimitChange = vi.fn();

    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    );

    const select = screen.getByLabelText('每页显示');
    await user.selectOptions(select, '50');

    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('应该正确计算总页数', () => {
    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    // 45 / 20 = 2.25 -> 3 页
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('应该在 total 为 0 时显示 1 页', () => {
    render(
      <ResourcePagination
        page={1}
        limit={20}
        total={0}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('应该高亮当前页码', () => {
    render(
      <ResourcePagination
        page={2}
        limit={20}
        total={45}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    const page2Button = screen.getByText('2');
    expect(page2Button).toHaveClass('bg-primary-600');
  });
});

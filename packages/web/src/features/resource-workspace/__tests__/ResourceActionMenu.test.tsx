/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ResourceActionMenu } from '../components/ResourceActionMenu';

describe('ResourceActionMenu', () => {
  const mockActions = [
    { id: 'logs', label: '查看日志', icon: '📄', disabled: false },
    { id: 'config', label: '配置', icon: '⚙️', disabled: false },
    { id: 'delete', label: '删除', icon: '🗑️', disabled: false },
  ];

  afterEach(() => {
    cleanup();
  });

  it('should render trigger button', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={mockActions} onAction={onAction} />);
    
    expect(screen.getByText('更多')).toBeInTheDocument();
  });

  it('should show menu when trigger button is clicked', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={mockActions} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    
    expect(screen.getByText('查看日志')).toBeInTheDocument();
    expect(screen.getByText('配置')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('should hide menu when trigger button is clicked again', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={mockActions} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    expect(screen.getByText('查看日志')).toBeInTheDocument();
    
    fireEvent.click(trigger);
    expect(screen.queryByText('查看日志')).not.toBeInTheDocument();
  });

  it('should call onAction when menu item is clicked', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={mockActions} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    
    const logsItem = screen.getByText('查看日志');
    fireEvent.click(logsItem);
    
    expect(onAction).toHaveBeenCalledWith('logs');
  });

  it('should close menu after action is triggered', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={mockActions} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    
    const logsItem = screen.getByText('查看日志');
    fireEvent.click(logsItem);
    
    expect(screen.queryByText('查看日志')).not.toBeInTheDocument();
  });

  it('should not call onAction for disabled items', () => {
    const onAction = vi.fn();
    const actionsWithDisabled = [
      { id: 'logs', label: '查看日志', icon: '📄', disabled: true },
      { id: 'config', label: '配置', icon: '⚙️', disabled: false },
    ];
    
    render(<ResourceActionMenu actions={actionsWithDisabled} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    
    const logsItem = screen.getByText('查看日志');
    fireEvent.click(logsItem);
    
    expect(onAction).not.toHaveBeenCalled();
  });

  it('should render disabled items with gray style', () => {
    const onAction = vi.fn();
    const actionsWithDisabled = [
      { id: 'logs', label: '查看日志', icon: '📄', disabled: true },
      { id: 'config', label: '配置', icon: '⚙️', disabled: false },
    ];
    
    render(<ResourceActionMenu actions={actionsWithDisabled} onAction={onAction} />);
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    
    const logsItem = screen.getByText('查看日志').closest('button');
    expect(logsItem).toHaveClass('opacity-50');
    expect(logsItem).toHaveClass('cursor-not-allowed');
  });

  it('should close menu when clicking outside', () => {
    const onAction = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ResourceActionMenu actions={mockActions} onAction={onAction} />
      </div>
    );
    
    const trigger = screen.getByText('更多');
    fireEvent.click(trigger);
    expect(screen.getByText('查看日志')).toBeInTheDocument();
    
    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);
    
    expect(screen.queryByText('查看日志')).not.toBeInTheDocument();
  });

  it('should render empty state when no actions provided', () => {
    const onAction = vi.fn();
    render(<ResourceActionMenu actions={[]} onAction={onAction} />);
    
    expect(screen.getByText('更多')).toBeInTheDocument();
  });
});

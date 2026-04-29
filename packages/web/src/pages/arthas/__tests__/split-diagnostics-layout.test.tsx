// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitDiagnosticsLayout } from '../components/SplitDiagnosticsLayout.js';

describe('SplitDiagnosticsLayout', () => {
  test('渲染左右分区容器', () => {
    render(
      <SplitDiagnosticsLayout
        left={<div data-testid="left-pane">LEFT</div>}
        right={<div data-testid="right-pane">RIGHT</div>}
      />,
    );

    expect(screen.getByTestId('left-pane')).not.toBeNull();
    expect(screen.getByTestId('right-pane')).not.toBeNull();
  });

  test('包含桌面分栏与移动堆叠 class', () => {
    const { container } = render(
      <SplitDiagnosticsLayout left={<div>LEFT</div>} right={<div>RIGHT</div>} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('grid-cols-1');
    expect(root.className).toContain('xl:grid-cols-5');
  });
});

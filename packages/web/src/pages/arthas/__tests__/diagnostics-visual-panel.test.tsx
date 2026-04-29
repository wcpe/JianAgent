// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagnosticsVisualPanel } from '../components/DiagnosticsVisualPanel.js';
import type { ParsedDiagnosticsView } from '../types/diagnostics-view.js';

describe('DiagnosticsVisualPanel', () => {
  test('渲染 version 组件', () => {
    const view: ParsedDiagnosticsView = {
      type: 'version',
      data: { version: '4.1.8' },
      raw: '{"version":"4.1.8"}',
    };

    render(<DiagnosticsVisualPanel view={view} />);
    expect(screen.getByText('Arthas 版本')).not.toBeNull();
    expect(screen.getByText('4.1.8')).not.toBeNull();
  });

  test('raw 类型展示回退卡片', () => {
    const view: ParsedDiagnosticsView = {
      type: 'raw',
      raw: 'plain output',
    };

    render(<DiagnosticsVisualPanel view={view} />);
    expect(screen.getByText('原始输出')).not.toBeNull();
  });
});

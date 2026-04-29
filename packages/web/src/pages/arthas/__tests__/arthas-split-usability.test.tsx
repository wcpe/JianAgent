// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagnosticsVisualPanel } from '../components/DiagnosticsVisualPanel.js';

describe('arthas split usability', () => {
  test('无结构化数据时显示空态', () => {
    render(<DiagnosticsVisualPanel view={null} />);
    expect(screen.getByText('暂无结构化数据')).not.toBeNull();
  });

  test('raw 结果时显示原始输出区块', () => {
    render(<DiagnosticsVisualPanel view={{ type: 'raw', raw: 'hello' }} />);
    expect(screen.getByText('原始输出')).not.toBeNull();
    expect(screen.getByText('hello')).not.toBeNull();
  });
});

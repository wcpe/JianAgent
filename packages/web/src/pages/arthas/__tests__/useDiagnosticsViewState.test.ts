// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiagnosticsViewState } from '../hooks/useDiagnosticsViewState.js';

describe('useDiagnosticsViewState', () => {
  test('初始化为空且可追加事件', () => {
    const { result } = renderHook(() => useDiagnosticsViewState());

    expect(result.current.events.length).toBe(0);

    act(() => {
      result.current.pushEvent({ kind: 'raw', text: 'hello', ts: 1 });
    });

    expect(result.current.events.length).toBe(1);
    expect(result.current.events[0]?.kind).toBe('raw');
  });

  test('clearEvents 清空事件', () => {
    const { result } = renderHook(() => useDiagnosticsViewState());

    act(() => {
      result.current.pushEvent({ kind: 'raw', text: 'x', ts: 1 });
      result.current.pushEvent({ kind: 'structured', payload: { type: 'version' }, ts: 2 });
    });

    expect(result.current.events.length).toBe(2);

    act(() => {
      result.current.clearEvents();
    });

    expect(result.current.events.length).toBe(0);
  });
});

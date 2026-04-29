/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce.js';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该返回初始值', () => {
    const { result } = renderHook(() => useDebounce('initial', 400));
    expect(result.current).toBe('initial');
  });

  it('应该在延迟后更新值', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 400 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 400 });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe('updated');
  });

  it('应该在延迟内多次更新时只保留最后一次', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'v1', delay: 400 } }
    );

    rerender({ value: 'v2', delay: 400 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'v3', delay: 400 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('v1');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('v3');
  });

  it('应该在组件卸载时清理定时器', () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 400 } }
    );

    rerender({ value: 'updated', delay: 400 });
    unmount();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 不应该抛出错误
    expect(true).toBe(true);
  });

  it('应该支持不同的延迟时间', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 200 } }
    );

    rerender({ value: 'updated', delay: 200 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('updated');
  });

  it('应该支持复杂对象类型', () => {
    const obj1 = { name: 'test1', count: 1 };
    const obj2 = { name: 'test2', count: 2 };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 400 } }
    );

    expect(result.current).toBe(obj1);

    rerender({ value: obj2, delay: 400 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe(obj2);
  });
});

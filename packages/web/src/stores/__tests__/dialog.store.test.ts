import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDialogStore } from '../dialog.store.js';

beforeEach(() => {
  useDialogStore.setState({
    toasts: [],
    confirmOpen: false,
    confirmOptions: null,
    confirmResolver: null,
  });
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

import { afterEach } from 'vitest';

describe('useDialogStore', () => {
  describe('showToast', () => {
    it('adds a toast to the list', () => {
      useDialogStore.getState().showToast('hello', 'success');

      const toasts = useDialogStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.message).toBe('hello');
      expect(toasts[0]!.type).toBe('success');
    });

    it('defaults to info type', () => {
      useDialogStore.getState().showToast('test');
      expect(useDialogStore.getState().toasts[0]!.type).toBe('info');
    });

    it('caps at MAX_TOASTS (5)', () => {
      for (let i = 0; i < 7; i++) {
        useDialogStore.getState().showToast(`msg-${i}`);
      }
      expect(useDialogStore.getState().toasts).toHaveLength(5);
    });

    it('auto-removes toast after 3s', () => {
      useDialogStore.getState().showToast('temp');
      expect(useDialogStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(3000);
      expect(useDialogStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('removeToast', () => {
    it('removes specific toast by id', () => {
      useDialogStore.getState().showToast('A');
      useDialogStore.getState().showToast('B');
      const id = useDialogStore.getState().toasts[0]!.id;

      useDialogStore.getState().removeToast(id);
      expect(useDialogStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('confirm', () => {
    it('opens dialog and resolves on confirm', async () => {
      const promise = useDialogStore.getState().confirm({ title: 'Delete?', message: 'Sure?' });

      expect(useDialogStore.getState().confirmOpen).toBe(true);
      expect(useDialogStore.getState().confirmOptions?.title).toBe('Delete?');

      useDialogStore.getState().resolveConfirm(true);

      await expect(promise).resolves.toBe(true);
      expect(useDialogStore.getState().confirmOpen).toBe(false);
    });

    it('resolves false on cancel', async () => {
      const promise = useDialogStore.getState().confirm({ title: 'X', message: 'Y' });
      useDialogStore.getState().resolveConfirm(false);
      await expect(promise).resolves.toBe(false);
    });
  });
});

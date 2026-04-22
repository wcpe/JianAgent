import { create } from 'zustand';

/* ── Toast ── */

export interface ToastItem {
  readonly id: string;
  readonly message: string;
  readonly type: 'success' | 'error' | 'info';
}

/* ── Confirm Dialog ── */

interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: 'danger' | 'default';
}

interface DialogState {
  readonly toasts: readonly ToastItem[];
  readonly confirmOpen: boolean;
  readonly confirmOptions: ConfirmOptions | null;
  readonly confirmResolver: ((confirmed: boolean) => void) | null;
}

interface DialogActions {
  showToast: (message: string, type?: ToastItem['type']) => void;
  removeToast: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
}

const MAX_TOASTS = 5;

export const useDialogStore = create<DialogState & DialogActions>((set, get) => ({
  toasts: [],
  confirmOpen: false,
  confirmOptions: null,
  confirmResolver: null,

  showToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const toast: ToastItem = { id, message, type };
    set((s) => ({ toasts: [toast, ...s.toasts].slice(0, MAX_TOASTS) }));
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ confirmOpen: true, confirmOptions: options, confirmResolver: resolve });
    });
  },

  resolveConfirm: (confirmed) => {
    const resolver = get().confirmResolver;
    set({ confirmOpen: false, confirmOptions: null, confirmResolver: null });
    resolver?.(confirmed);
  },
}));

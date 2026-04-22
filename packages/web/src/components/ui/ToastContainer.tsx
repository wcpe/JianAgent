import { useDialogStore, type ToastItem } from '../../stores/dialog.store.js';

const typeStyles: Record<ToastItem['type'], string> = {
  success: 'bg-green-600/90 text-white border border-green-500/30',
  error: 'bg-red-600/90 text-white border border-red-500/30',
  info: 'bg-primary-600/90 dark:bg-primary-700/80 text-white border border-primary-500/30',
};

export function ToastContainer() {
  const toasts = useDialogStore((s) => s.toasts);
  const removeToast = useDialogStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-xl shadow-xl text-sm flex items-center gap-2 animate-slide-in backdrop-blur-xl ${typeStyles[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-70 hover:opacity-100 text-xs font-bold transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

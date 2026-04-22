import { useDialogStore } from '../../stores/dialog.store.js';

export function ConfirmDialog() {
  const open = useDialogStore((s) => s.confirmOpen);
  const options = useDialogStore((s) => s.confirmOptions);
  const resolve = useDialogStore((s) => s.resolveConfirm);

  if (!open || !options) return null;

  const isDanger = options.variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - glass effect */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => resolve(false)}
      />

      {/* Dialog - enhanced glass styling */}
      <div className="relative bg-white/90 dark:bg-slate-900/70 rounded-2xl shadow-2xl border border-white/50 dark:border-primary-300/20 p-6 max-w-sm w-full mx-4 animate-scale-in backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {options.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {options.message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => resolve(false)}
            className="px-4 py-2 text-sm rounded-lg bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-primary-300/15 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all backdrop-blur-md"
          >
            {options.cancelLabel ?? '取消'}
          </button>
          <button
            onClick={() => resolve(true)}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium transition-all backdrop-blur-md ${
              isDanger
                ? 'bg-red-600/90 hover:bg-red-700 border border-red-500/30'
                : 'bg-primary-600/90 hover:bg-primary-700 border border-primary-500/30'
            }`}
          >
            {options.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

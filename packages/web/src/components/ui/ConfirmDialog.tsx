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

      {/* Dialog - solid styling */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4 animate-scale-in">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {options.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {options.message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => resolve(false)}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            {options.cancelLabel ?? '取消'}
          </button>
          <button
            onClick={() => resolve(true)}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium transition-all ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 border border-red-500'
                : 'bg-blue-600 hover:bg-blue-700 border border-blue-500'
            }`}
          >
            {options.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';

interface ErrorAlertProps {
  readonly message: string;
  readonly onDismiss?: () => void;
  readonly className?: string;
}

export function ErrorAlert({ message, onDismiss, className = '' }: ErrorAlertProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [message]);

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-danger-200 dark:border-danger-700/50 bg-danger-50/80 dark:bg-danger-900/20 px-3.5 py-3 text-sm ${className}`}>
      <AlertTriangle size={15} className="text-danger-500 dark:text-danger-400 shrink-0 mt-0.5" />
      <span className="flex-1 text-danger-700 dark:text-danger-300 break-all">{message}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded-md text-danger-400 hover:text-danger-600 dark:hover:text-danger-200 hover:bg-danger-100 dark:hover:bg-danger-800/40 transition-colors"
          title="复制错误信息"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-danger-400 hover:text-danger-600 dark:hover:text-danger-200 hover:bg-danger-100 dark:hover:bg-danger-800/40 transition-colors"
            title="关闭"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

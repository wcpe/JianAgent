import { useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mb-4">
        <AlertTriangle size={24} className="text-danger-500 dark:text-danger-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">出错了</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm">{message}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制错误'}
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}
      </div>
    </div>
  );
}

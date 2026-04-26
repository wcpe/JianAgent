// packages/web/src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorText = this.state.error
        ? `Error: ${this.state.error.message}\n\n${this.state.error.stack ?? ''}`
        : 'No error object';

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            页面出错了
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
            发生了意外错误，请稍后重试。
          </p>
          <div className="relative bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 text-danger-800 dark:text-danger-200 p-4 rounded-xl text-left overflow-auto max-w-2xl text-xs group">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(errorText).catch(() => {})}
              className="absolute top-2 right-2 p-1.5 rounded-lg text-danger-400 hover:text-danger-600 dark:hover:text-danger-200 hover:bg-danger-100 dark:hover:bg-danger-800/40 opacity-0 group-hover:opacity-100 transition-all"
              title="复制错误信息"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
            <h3 data-testid="error-message">{this.state.error ? 'Error: ' + this.state.error.message : 'No error object'}</h3>
            <pre data-testid="error-stack" className="mt-2 whitespace-pre-wrap">{this.state.error?.stack}</pre>
          </div>
          <button
            onClick={this.handleReset}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm transition-colors"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { type SelectHTMLAttributes } from 'react';

interface StyledSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly variant?: 'default' | 'compact';
}

const baseClasses =
  'appearance-none bg-white/80 dark:bg-slate-900/60 border border-white/55 dark:border-primary-300/20 ' +
  'rounded-lg text-gray-800 dark:text-gray-200 pr-8 bg-no-repeat bg-[length:16px_16px] ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-300 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-all backdrop-blur-md shadow-sm';

const sizeClasses = {
  default: 'px-3 py-2 text-sm',
  compact: 'px-2 py-1 text-xs',
} as const;

const chevronSvg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function StyledSelect({ variant = 'default', className = '', style, ...props }: StyledSelectProps) {
  const classes = `${baseClasses} ${sizeClasses[variant]} ${className}`;
  return (
    <select
      {...props}
      className={classes}
      style={{
        backgroundImage: chevronSvg,
        backgroundPosition: 'right 0.5rem center',
        ...style,
      }}
    />
  );
}

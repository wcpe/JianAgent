import type { FC } from 'react';

interface Props {
  readonly level: string;
}

const COLORS: Record<string, string> = {
  INFO: 'bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-400',
  WARNING: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  CRITICAL: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
};

const AlertBadge: FC<Props> = ({ level }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${COLORS[level] ?? 'bg-gray-100 dark:bg-gray-700'}`}>
    {level}
  </span>
);

export default AlertBadge;

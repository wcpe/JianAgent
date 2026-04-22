import type { FC } from 'react';

interface Props {
  readonly level: string;
}

const COLORS: Record<string, string> = {
  INFO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  WARNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  CRITICAL: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const AlertBadge: FC<Props> = ({ level }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${COLORS[level] ?? 'bg-gray-100 dark:bg-gray-700'}`}>
    {level}
  </span>
);

export default AlertBadge;

import { type FC, type ReactNode } from 'react';

interface StatusCardProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string | number;
  readonly color?: 'green' | 'yellow' | 'red' | 'gray' | 'blue';
  readonly subtitle?: string;
}

const colorMap: Record<string, string> = {
  green: 'border-success-500 text-success-400',
  yellow: 'border-warning-500 text-warning-400',
  red: 'border-danger-500 text-danger-400',
  gray: 'border-gray-500 text-gray-400',
  blue: 'border-info-500 text-info-400',
};

const StatusCard: FC<StatusCardProps> = ({ icon, label, value, color = 'gray', subtitle }) => {
  const colorClass = colorMap[color] ?? colorMap['gray'];

  return (
    <div className={`rounded-lg bg-gray-800 border-l-4 p-4 ${colorClass}`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl flex-shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatusCard;

import type React from 'react';

export const TOOLTIP_STYLE = { backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F3F4F6' };

export const PIE_COLORS = [
  '#22C55E', '#3B82F6', '#EAB308', '#EF4444', '#A855F7',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#8B5CF6',
  '#F43F5E', '#10B981', '#6366F1', '#D946EF', '#0EA5E9',
];

export function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface ChartCardProps {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
  readonly lastValue?: string;
  readonly accentColor?: string;
  readonly tall?: boolean;
}

export function ChartCard({ title, icon, children, lastValue, accentColor, tall }: ChartCardProps) {
  return (
    <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        </div>
        {lastValue && (
          <span className={`text-lg font-bold ${accentColor ?? 'text-gray-900 dark:text-gray-100'}`}>
            {lastValue}
          </span>
        )}
      </div>
      <div style={{ minHeight: tall ? 256 : 192 }}>{children}</div>
    </div>
  );
}

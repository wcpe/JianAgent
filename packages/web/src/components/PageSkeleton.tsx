// packages/web/src/components/PageSkeleton.tsx
interface PageSkeletonProps {
  readonly titleWidth?: string;
  readonly rows?: number;
  readonly hasChart?: boolean;
}

export function PageSkeleton({
  titleWidth = 'w-48',
  rows = 3,
  hasChart = false,
}: PageSkeletonProps) {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className={`h-8 ${titleWidth} bg-gray-200 dark:bg-gray-700 rounded`} />

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
            style={{ width: `${100 - i * 15}%` }}
          />
        ))}
      </div>

      {/* Chart placeholder */}
      {hasChart && (
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  trend?: {
    value: number; // percentage change
    label?: string; // e.g., "vs yesterday"
  };
  warning?: boolean;
  warningText?: string;
}

export default function SummaryCard({
  title,
  value,
  trend,
  warning,
  warningText,
}: SummaryCardProps) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  const trendNeutral = trend && trend.value === 0;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>

      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          {trendUp && (
            <>
              <span className="text-green-400">↑</span>
              <span className="text-green-400">{Math.abs(trend.value).toFixed(1)}%</span>
            </>
          )}
          {trendDown && (
            <>
              <span className="text-red-400">↓</span>
              <span className="text-red-400">{Math.abs(trend.value).toFixed(1)}%</span>
            </>
          )}
          {trendNeutral && (
            <span className="text-gray-400">─ 0%</span>
          )}
          {trend.label && (
            <span className="text-gray-500">{trend.label}</span>
          )}
        </div>
      )}

      {warning && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          <svg
            className="h-4 w-4 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-yellow-400">
            {warningText || "Above threshold"}
          </span>
        </div>
      )}
    </div>
  );
}

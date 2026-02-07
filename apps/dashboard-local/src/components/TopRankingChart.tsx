import { Link } from "react-router-dom";

interface RankingItem {
  label: string;
  value: number;
  formattedValue: string;
  percentage: number;
  link?: string;
}

interface TopRankingChartProps {
  title: string;
  items: RankingItem[];
  emptyText?: string;
}

export default function TopRankingChart({
  title,
  items,
  emptyText = "No data",
}: TopRankingChartProps) {
  const maxPercentage = Math.max(...items.map((i) => i.percentage), 1);

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
        {title}
      </h3>
      {items.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-4 text-xs text-gray-500">{index + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  {item.link ? (
                    <Link
                      to={item.link}
                      className="truncate text-sm text-blue-400 hover:text-blue-300"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="truncate text-sm text-gray-300">
                      {item.label}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-medium text-white">
                    {item.formattedValue}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${(item.percentage / maxPercentage) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

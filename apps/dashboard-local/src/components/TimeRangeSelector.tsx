type Range = "1h" | "24h" | "7d" | "30d" | "custom";

const PRESET_RANGES: Range[] = ["1h", "24h", "7d", "30d"];

interface TimeRangeSelectorProps {
  value: Range;
  onChange: (range: Range) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (v: string) => void;
  onCustomToChange?: (v: string) => void;
  showCustom?: boolean;
}

export default function TimeRangeSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  showCustom = true,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            r === value
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
          }`}
        >
          {r}
        </button>
      ))}
      {showCustom && (
        <>
          <button
            onClick={() => onChange("custom")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              value === "custom"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
            }`}
          >
            Custom
          </button>
          {value === "custom" && onCustomFromChange && onCustomToChange && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom ?? ""}
                onChange={(e) => onCustomFromChange(e.target.value)}
                className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-200"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={customTo ?? ""}
                onChange={(e) => onCustomToChange(e.target.value)}
                className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-200"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

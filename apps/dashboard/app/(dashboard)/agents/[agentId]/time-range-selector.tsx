"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const RANGES = ["1h", "24h", "7d", "30d"] as const;

interface TimeRangeSelectorProps {
  currentRange: string;
  customFrom?: string;
  customTo?: string;
}

export function TimeRangeSelector({
  currentRange,
  customFrom,
  customTo,
}: TimeRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showCustom, setShowCustom] = useState(currentRange === "custom");
  const [from, setFrom] = useState(customFrom ?? "");
  const [to, setTo] = useState(customTo ?? "");

  const handleSelect = useCallback(
    (range: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", range);
      params.delete("from");
      params.delete("to");
      router.push(`${pathname}?${params.toString()}`);
      setShowCustom(false);
    },
    [router, pathname, searchParams]
  );

  const handleCustomApply = useCallback(() => {
    if (!from || !to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", from);
    params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, from, to]);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((range) => (
          <button
            key={range}
            onClick={() => handleSelect(range)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentRange === range
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {range}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            currentRange === "custom"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleCustomApply}
            disabled={!from || !to}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

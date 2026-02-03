const STATUS_STYLES: Record<string, string> = {
  healthy: "bg-green-900/50 text-green-400 border-green-700",
  degraded: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
  down: "bg-red-900/50 text-red-400 border-red-700",
  unknown: "bg-gray-800 text-gray-400 border-gray-600",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

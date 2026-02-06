const SIZES = {
  sm: { icon: "h-5 w-5", text: "text-sm" },
  md: { icon: "h-7 w-7", text: "text-lg" },
  lg: { icon: "h-9 w-9", text: "text-xl" },
} as const;

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = SIZES[size];
  return (
    <div className="flex items-center gap-2">
      <svg className={`${s.icon} text-blue-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
      <span className={`${s.text} font-semibold text-white`}>AgentGazer</span>
    </div>
  );
}

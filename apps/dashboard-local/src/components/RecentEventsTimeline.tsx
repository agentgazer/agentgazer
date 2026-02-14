import { Link } from "react-router-dom";
import { relativeTime } from "../lib/format";

export interface RecentEvent {
  type: "kill_switch" | "budget_warning" | "high_error_rate" | "new_agent" | "security";
  agent_id: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface RecentEventsTimelineProps {
  events: RecentEvent[];
}

const EVENT_LABELS: Record<RecentEvent["type"], string> = {
  kill_switch: "Kill Switch",
  budget_warning: "Budget",
  high_error_rate: "Error Rate",
  new_agent: "New Agent",
  security: "Security",
};

const EVENT_STYLES: Record<
  RecentEvent["type"],
  { icon: string; bg: string; text: string; border: string }
> = {
  kill_switch: {
    icon: "🔴",
    bg: "bg-red-900/20",
    text: "text-red-400",
    border: "border-red-800/50",
  },
  budget_warning: {
    icon: "💰",
    bg: "bg-yellow-900/20",
    text: "text-yellow-400",
    border: "border-yellow-800/50",
  },
  high_error_rate: {
    icon: "⚠️",
    bg: "bg-orange-900/20",
    text: "text-orange-400",
    border: "border-orange-800/50",
  },
  new_agent: {
    icon: "📥",
    bg: "bg-blue-900/20",
    text: "text-blue-400",
    border: "border-blue-800/50",
  },
  security: {
    icon: "🛡️",
    bg: "bg-purple-900/20",
    text: "text-purple-400",
    border: "border-purple-800/50",
  },
};

export default function RecentEventsTimeline({
  events,
}: RecentEventsTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No recent events
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event, index) => {
        const style = EVENT_STYLES[event.type];
        const label = EVENT_LABELS[event.type];
        return (
          <div
            key={`${event.agent_id}-${event.timestamp}-${index}`}
            className={`rounded border ${style.border} ${style.bg} px-2.5 py-1.5`}
          >
            {/* Line 1: Icon · Type · Agent · Time */}
            <div className="flex items-center gap-1.5 text-sm">
              <span>{style.icon}</span>
              <span className={`font-medium ${style.text}`}>{label}</span>
              <span className="text-gray-500">·</span>
              <Link
                to={`/agents/${encodeURIComponent(event.agent_id)}`}
                className="text-blue-400 hover:text-blue-300 truncate"
              >
                {event.agent_id}
              </Link>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500 text-xs whitespace-nowrap">
                {relativeTime(event.timestamp)}
              </span>
            </div>
            {/* Line 2: Message */}
            <p className="text-xs text-gray-400 truncate mt-0.5 ml-6">
              {event.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

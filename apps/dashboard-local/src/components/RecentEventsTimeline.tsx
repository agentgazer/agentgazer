import { Link } from "react-router-dom";
import { relativeTime } from "../lib/format";

export interface RecentEvent {
  type: "kill_switch" | "budget_warning" | "high_error_rate" | "new_agent";
  agent_id: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface RecentEventsTimelineProps {
  events: RecentEvent[];
}

const EVENT_STYLES: Record<
  RecentEvent["type"],
  { icon: string; bg: string; text: string; border: string }
> = {
  kill_switch: {
    icon: "🔴",
    bg: "bg-red-900/30",
    text: "text-red-400",
    border: "border-red-800",
  },
  budget_warning: {
    icon: "💰",
    bg: "bg-yellow-900/30",
    text: "text-yellow-400",
    border: "border-yellow-800",
  },
  high_error_rate: {
    icon: "⚠️",
    bg: "bg-orange-900/30",
    text: "text-orange-400",
    border: "border-orange-800",
  },
  new_agent: {
    icon: "📥",
    bg: "bg-blue-900/30",
    text: "text-blue-400",
    border: "border-blue-800",
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
    <div className="space-y-3">
      {events.map((event, index) => {
        const style = EVENT_STYLES[event.type];
        return (
          <div
            key={`${event.agent_id}-${event.timestamp}-${index}`}
            className={`rounded-lg border ${style.border} ${style.bg} p-3`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{style.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${style.text}`}>
                    {event.type === "kill_switch" && "Kill Switch"}
                    {event.type === "budget_warning" && "Budget Warning"}
                    {event.type === "high_error_rate" && "High Error Rate"}
                    {event.type === "new_agent" && "New Agent"}
                  </span>
                  <Link
                    to={`/agents/${encodeURIComponent(event.agent_id)}`}
                    className="text-sm text-blue-400 hover:text-blue-300 truncate"
                  >
                    {event.agent_id}
                  </Link>
                </div>
                <p className="mt-0.5 text-sm text-gray-300">{event.message}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {relativeTime(event.timestamp)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

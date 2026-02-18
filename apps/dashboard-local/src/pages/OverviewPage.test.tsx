import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import type { OverviewData, RecentEvent } from "../lib/api";

// Create a test i18n instance
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Mock the API module
const mockGetData = vi.fn();
const mockGetRecentEvents = vi.fn();

vi.mock("../lib/api", () => ({
  overviewApi: {
    getData: () => mockGetData(),
    getRecentEvents: () => mockGetRecentEvents(),
  },
  api: { get: vi.fn() },
  getToken: vi.fn(() => "test-token"),
  providerApi: { getConnectionInfo: vi.fn().mockResolvedValue({ isLoopback: false }) },
}));

// Mock recharts to avoid rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div />,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div />,
}));

import OverviewPage from "./OverviewPage";

const mockOverviewData: OverviewData = {
  active_agents: 5,
  today_cost: 12.5678,
  today_requests: 1500,
  error_rate: 2.3,
  yesterday_cost: 10.0,
  yesterday_requests: 1200,
  yesterday_error_rate: 1.5,
  top_agents: [
    { agent_id: "agent-1", cost: 5.0, percentage: 40 },
    { agent_id: "agent-2", cost: 3.5, percentage: 28 },
  ],
  top_models: [
    { model: "gpt-4o", tokens: 500000, percentage: 60 },
  ],
  cost_trend: [
    { date: "2026-02-13", value: 8 },
    { date: "2026-02-14", value: 10 },
  ],
  requests_trend: [
    { date: "2026-02-13", value: 1000 },
    { date: "2026-02-14", value: 1200 },
  ],
};

const mockEvents: RecentEvent[] = [
  {
    type: "new_agent",
    agent_id: "agent-1",
    message: "New agent detected",
    timestamp: "2026-02-19T10:00:00Z",
  },
];

function renderOverviewPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("renders summary cards with mock data", async () => {
    mockGetData.mockResolvedValue(mockOverviewData);
    mockGetRecentEvents.mockResolvedValue({ events: mockEvents });

    renderOverviewPage();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    // Check summary cards
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // active agents
    });
    expect(screen.getByText("$12.5678")).toBeInTheDocument(); // today's cost
    expect(screen.getByText("1,500")).toBeInTheDocument(); // requests
    expect(screen.getByText("2.3%")).toBeInTheDocument(); // error rate

    // Check summary card titles
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Today's Cost")).toBeInTheDocument();
    expect(screen.getByText("Requests (24h)")).toBeInTheDocument();
    expect(screen.getByText("Error Rate")).toBeInTheDocument();
  });

  it("renders top agents ranking", async () => {
    mockGetData.mockResolvedValue(mockOverviewData);
    mockGetRecentEvents.mockResolvedValue({ events: [] });

    renderOverviewPage();

    await waitFor(() => {
      expect(screen.getByText("agent-1")).toBeInTheDocument();
    });
    expect(screen.getByText("agent-2")).toBeInTheDocument();
  });

  it("renders trend chart sections", async () => {
    mockGetData.mockResolvedValue(mockOverviewData);
    mockGetRecentEvents.mockResolvedValue({ events: [] });

    renderOverviewPage();

    await waitFor(() => {
      expect(screen.getByText("Cost Trend (7 days)")).toBeInTheDocument();
    });
    expect(screen.getByText("Requests Trend (7 days)")).toBeInTheDocument();
  });

  it("shows error banner when API fails", async () => {
    mockGetData.mockRejectedValue(new Error("Network error"));
    mockGetRecentEvents.mockResolvedValue({ events: [] });

    renderOverviewPage();

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it("handles empty overview data gracefully", async () => {
    mockGetData.mockResolvedValue({
      active_agents: 0,
      today_cost: 0,
      today_requests: 0,
      error_rate: 0,
      yesterday_cost: 0,
      yesterday_requests: 0,
      yesterday_error_rate: 0,
      top_agents: [],
      top_models: [],
      cost_trend: [],
      requests_trend: [],
    });
    mockGetRecentEvents.mockResolvedValue({ events: [] });

    renderOverviewPage();

    await waitFor(() => {
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1); // active agents, requests, etc.
    });
    expect(screen.getByText("$0.0000")).toBeInTheDocument(); // cost
    expect(screen.getByText("No agent data")).toBeInTheDocument();
    expect(screen.getByText("No model data")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";

// Create a test i18n instance
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Mock the API module
const mockApiGet = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: vi.fn(),
  },
  getToken: vi.fn(() => "test-token"),
  providerApi: {
    getConnectionInfo: vi.fn().mockResolvedValue({ isLoopback: false }),
  },
}));

import AgentsPage from "./AgentsPage";

function renderAgentsPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("renders agents list with data", async () => {
    mockApiGet.mockResolvedValue({
      agents: [
        {
          agent_id: "my-agent",
          updated_at: new Date(Date.now() - 60_000).toISOString(),
          active: 1,
          total_tokens: 50000,
          total_cost: 5.1234,
          today_cost: 1.0001,
          providers: [{ provider: "openai", has_override: false }],
        },
        {
          agent_id: "backup-agent",
          updated_at: new Date(Date.now() - 3_600_000).toISOString(),
          active: 0,
          deactivated_by: "kill_switch",
          kill_switch_enabled: 1,
          total_tokens: 10000,
          total_cost: 0.5,
          today_cost: 0.0,
          providers: [],
        },
      ],
      total: 2,
    });

    renderAgentsPage();

    await waitFor(() => {
      expect(screen.getByText("my-agent")).toBeInTheDocument();
    });

    expect(screen.getByText("backup-agent")).toBeInTheDocument();
    expect(screen.getByText("$5.1234")).toBeInTheDocument();
    expect(screen.getByText("$1.0001")).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
    expect(screen.getByText("openai")).toBeInTheDocument();
  });

  it("shows empty state when no agents", async () => {
    mockApiGet.mockResolvedValue({
      agents: [],
      total: 0,
    });

    renderAgentsPage();

    await waitFor(() => {
      expect(screen.getByText("No agents found.")).toBeInTheDocument();
    });
  });

  it("renders the page title", async () => {
    mockApiGet.mockResolvedValue({ agents: [], total: 0 });

    renderAgentsPage();

    await waitFor(() => {
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });
  });

  it("shows kill switch badge for agents with kill switch enabled", async () => {
    mockApiGet.mockResolvedValue({
      agents: [
        {
          agent_id: "loopy-agent",
          updated_at: new Date().toISOString(),
          active: 0,
          deactivated_by: "kill_switch",
          kill_switch_enabled: 1,
          total_tokens: 0,
          total_cost: 0,
          today_cost: 0,
          providers: [],
        },
      ],
      total: 1,
    });

    renderAgentsPage();

    await waitFor(() => {
      expect(screen.getByText("loopy-agent")).toBeInTheDocument();
    });

    // Kill switch badge should appear
    expect(screen.getAllByText("Kill Switch").length).toBeGreaterThanOrEqual(1);
  });

  it("renders table headers", async () => {
    mockApiGet.mockResolvedValue({
      agents: [
        {
          agent_id: "test",
          updated_at: new Date().toISOString(),
          active: 1,
          total_tokens: 0,
          total_cost: 0,
          today_cost: 0,
        },
      ],
      total: 1,
    });

    renderAgentsPage();

    await waitFor(() => {
      expect(screen.getByText("Agent ID")).toBeInTheDocument();
    });
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Last Activity")).toBeInTheDocument();
    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});

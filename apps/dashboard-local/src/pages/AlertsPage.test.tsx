import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDel = vi.fn();
const mockApiPatch = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
    put: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
  getToken: vi.fn(() => "test-token"),
  providerApi: {
    getConnectionInfo: vi.fn().mockResolvedValue({ isLoopback: false }),
  },
}));

import AlertsPage from "./AlertsPage";

const mockAlertRules = {
  alerts: [
    {
      id: "alert-1",
      agent_id: "agent-1",
      rule_type: "budget",
      config: { threshold: 100 },
      notification_type: "webhook",
      webhook_url: "https://hooks.example.com/notify",
      enabled: true,
    },
    {
      id: "alert-2",
      agent_id: "agent-2",
      rule_type: "error_rate",
      config: { threshold: 10, window_minutes: 15 },
      notification_type: "email",
      enabled: false,
    },
  ],
  total: 2,
};

const mockHistory = {
  history: [
    {
      id: "hist-1",
      timestamp: new Date().toISOString(),
      agent_id: "agent-1",
      rule_type: "budget",
      message: "Daily budget exceeded $100",
      delivered_via: "webhook",
    },
  ],
  total: 1,
};

function renderAlertsPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("AlertsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith("/api/alerts")) {
        return Promise.resolve(mockAlertRules);
      }
      if (path.startsWith("/api/alert-history")) {
        return Promise.resolve(mockHistory);
      }
      if (path.startsWith("/api/agents")) {
        return Promise.resolve({
          agents: [{ agent_id: "agent-1" }, { agent_id: "agent-2" }],
        });
      }
      if (path.startsWith("/api/settings")) {
        return Promise.resolve({ alerts: {} });
      }
      return Promise.resolve({});
    });
  });

  it("renders the page title", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("Alerts")).toBeInTheDocument();
    });
  });

  it("shows Rules and History tabs", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("Rules")).toBeInTheDocument();
    });
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders alert rules list", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("agent-1")).toBeInTheDocument();
    });
    expect(screen.getByText("agent-2")).toBeInTheDocument();
    // Check rule type badges (multiple matches due to form select options, use getAllByText)
    expect(screen.getAllByText("Budget Exceeded").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Error Rate").length).toBeGreaterThanOrEqual(1);
  });

  it("shows config summary for each rule", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("Cost > $100.00")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Errors > 10% / 15min")
    ).toBeInTheDocument();
  });

  it("shows empty state when no rules exist", async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith("/api/alerts")) {
        return Promise.resolve({ alerts: [], total: 0 });
      }
      if (path.startsWith("/api/alert-history")) {
        return Promise.resolve({ history: [], total: 0 });
      }
      return Promise.resolve({});
    });

    renderAlertsPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          "No alert rules configured. Create one to get started."
        )
      ).toBeInTheDocument();
    });
  });

  it("shows New Alert Rule button", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("New Alert Rule")).toBeInTheDocument();
    });
  });

  it("opens form when New Alert Rule is clicked", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("New Alert Rule")).toBeInTheDocument();
    });

    await user.click(screen.getByText("New Alert Rule"));

    // The form should now be visible with Agent and Rule Type fields
    await waitFor(() => {
      expect(screen.getByText("Agent")).toBeInTheDocument();
    });
    expect(screen.getByText("Rule Type")).toBeInTheDocument();
    expect(screen.getByText("Notification Settings")).toBeInTheDocument();
  });

  it("shows edit and delete buttons for each rule", async () => {
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("agent-1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");
    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  it("switches to History tab and shows entries", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("History")).toBeInTheDocument();
    });

    await user.click(screen.getByText("History"));

    await waitFor(() => {
      expect(
        screen.getByText("Daily budget exceeded $100")
      ).toBeInTheDocument();
    });
  });

  it("shows empty history state", async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith("/api/alerts")) {
        return Promise.resolve({ alerts: [], total: 0 });
      }
      if (path.startsWith("/api/alert-history")) {
        return Promise.resolve({ history: [], total: 0 });
      }
      return Promise.resolve({});
    });

    renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText("History")).toBeInTheDocument();
    });

    await user.click(screen.getByText("History"));

    await waitFor(() => {
      expect(screen.getByText("No alert history yet.")).toBeInTheDocument();
    });
  });
});

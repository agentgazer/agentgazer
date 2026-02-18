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
const mockApiPut = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    post: vi.fn(),
  },
  getToken: vi.fn(() => "test-token"),
  providerApi: {
    getConnectionInfo: vi.fn().mockResolvedValue({ isLoopback: false }),
  },
}));

import SecurityPage from "./SecurityPage";

const mockSecurityConfig = {
  agent_id: null,
  prompt_injection: {
    action: "log" as const,
    rules: {
      ignore_instructions: true,
      system_override: true,
      role_hijacking: false,
      jailbreak: true,
    },
    custom: [],
  },
  data_masking: {
    replacement: "[REDACTED]",
    rules: {
      api_keys: true,
      credit_cards: true,
      personal_data: false,
      crypto: false,
      env_vars: true,
      hardware_fingerprint: false,
    },
    custom: [],
  },
  tool_restrictions: {
    action: "block" as const,
    rules: {
      max_per_request: null,
      max_per_minute: null,
      block_filesystem: false,
      block_network: false,
      block_code_execution: false,
    },
    allowlist: [],
    blocklist: [],
  },
};

function renderSecurityPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("SecurityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith("/api/security/config")) {
        return Promise.resolve(mockSecurityConfig);
      }
      if (path.startsWith("/api/agents")) {
        return Promise.resolve({ agents: [{ agent_id: "agent-1" }] });
      }
      if (path.startsWith("/api/security/events")) {
        return Promise.resolve({ events: [], total: 0 });
      }
      return Promise.resolve({});
    });
    mockApiPut.mockResolvedValue(mockSecurityConfig);
  });

  it("renders security page title and subtitle", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("Security")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Configure security rules for prompt injection detection, data masking, and tool restrictions"
      )
    ).toBeInTheDocument();
  });

  it("renders config tab with security sections", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("Self Protection")).toBeInTheDocument();
    });

    expect(screen.getByText("Always Enabled")).toBeInTheDocument();
    expect(screen.getByText("Prompt Injection Detection")).toBeInTheDocument();
    expect(screen.getByText("Sensitive Data Masking")).toBeInTheDocument();
    expect(screen.getByText("Tool Call Restrictions")).toBeInTheDocument();
  });

  it("renders prompt injection rules", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(
        screen.getByText("Ignore previous instructions")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("System prompt override")).toBeInTheDocument();
    expect(screen.getByText("Role hijacking")).toBeInTheDocument();
    expect(screen.getByText("Jailbreak patterns")).toBeInTheDocument();
  });

  it("renders data masking rules", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("API Keys")).toBeInTheDocument();
    });
    expect(screen.getByText("Credit Card Numbers")).toBeInTheDocument();
    expect(
      screen.getByText("Personal Data (SSN, Email, Phone)")
    ).toBeInTheDocument();
    expect(screen.getByText("Environment Variables")).toBeInTheDocument();
  });

  it("renders tool restriction rules", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("Block filesystem tools")).toBeInTheDocument();
    });
    expect(screen.getByText("Block network tools")).toBeInTheDocument();
    expect(screen.getByText("Block code execution")).toBeInTheDocument();
  });

  it("has Configuration and Security Events tabs", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("Configuration")).toBeInTheDocument();
    });
    expect(screen.getByText("Security Events")).toBeInTheDocument();
  });

  it("switches to Security Events tab", async () => {
    const user = userEvent.setup();
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("Security Events")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Security Events"));

    // Events tab should show filter controls and table
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  it("shows agent selector dropdown", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(screen.getByText("All Agents (Global)")).toBeInTheDocument();
    });
  });

  it("renders self-protection items", async () => {
    renderSecurityPage();

    await waitFor(() => {
      expect(
        screen.getByText("Block access to ~/.agentgazer/ configuration files")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Block access to AgentGazer database (data.db)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Block access to stored secrets and API keys")
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
vi.mock("../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
  setToken: vi.fn(),
  getToken: vi.fn(() => null),
  clearToken: vi.fn(),
}));

import LoginPage from "./LoginPage";
import { api, setToken } from "../lib/api";

const mockedApiPost = vi.mocked(api.post);
const mockedSetToken = vi.mocked(setToken);

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLoginPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with title and input", () => {
    renderLoginPage();

    expect(screen.getByText("AgentGazer")).toBeInTheDocument();
    expect(screen.getByText("Enter your token to continue")).toBeInTheDocument();
    expect(screen.getByLabelText("Token")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  it("requires the token input (has required attribute)", () => {
    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    expect(tokenInput).toBeRequired();
  });

  it("token input is of type password", () => {
    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    expect(tokenInput).toHaveAttribute("type", "password");
  });

  it("allows typing in the token input", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    await user.type(tokenInput, "my-secret-token");
    expect(tokenInput).toHaveValue("my-secret-token");
  });

  it("submits and navigates on successful login", async () => {
    const user = userEvent.setup();
    mockedApiPost.mockResolvedValueOnce({ ok: true });

    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    await user.type(tokenInput, "valid-token");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(mockedApiPost).toHaveBeenCalledWith("/api/auth/verify", {
      token: "valid-token",
    });
    expect(mockedSetToken).toHaveBeenCalledWith("valid-token");
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup();
    mockedApiPost.mockRejectedValueOnce(new Error("Bad token"));

    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    await user.type(tokenInput, "bad-token");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Invalid token")).toBeInTheDocument();
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();
    // Make the API call hang
    mockedApiPost.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderLoginPage();

    const tokenInput = screen.getByLabelText("Token");
    await user.type(tokenInput, "some-token");
    await user.click(screen.getByRole("button", { name: "Login" }));

    // Button should show "Verifying..." and be disabled
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
  });
});

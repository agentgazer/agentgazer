import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { providerApi, oauthApi, type ProviderInfo } from "../lib/api";
import { useConnection } from "../contexts/ConnectionContext";
import { usePolling } from "../hooks/usePolling";
import { formatCost } from "../lib/format";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

const PROVIDER_ICONS: Record<string, string> = {
  openai: "O",
  "openai-oauth": "C",  // C for Codex
  anthropic: "A",
  google: "G",
  mistral: "M",
  deepseek: "D",
  moonshot: "m",
  zhipu: "Z",
  "zhipu-coding-plan": "Z",
  minimax: "X",
  "minimax-oauth": "X",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI (GPT-4o, o1, o3)",
  "openai-oauth": "OpenAI Codex (OAuth)",
  anthropic: "Anthropic (Claude Opus, Sonnet, Haiku)",
  google: "Google (Gemini)",
  mistral: "Mistral (Mistral Large, Codestral)",
  deepseek: "DeepSeek (V3, R1)",
  moonshot: "Moonshot (Kimi K2.5)",
  zhipu: "Zhipu / Z.ai (GLM-4.7)",
  "zhipu-coding-plan": "Zhipu Coding Plan (GLM-4.7, Subscription)",
  minimax: "MiniMax (M2)",
  "minimax-oauth": "MiniMax Coding Plan (OAuth)",
};

// OAuth providers configuration
const OAUTH_PROVIDERS = [
  { name: "openai-oauth", label: "Codex", color: "green" },
  { name: "minimax-oauth", label: "MiniMax", color: "purple" },
] as const;

export default function ProvidersPage() {
  const { t } = useTranslation();
  const { isLoopback } = useConnection();
  const [showAddModal, setShowAddModal] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  // OAuth state - per provider
  const [oauthLoading, setOauthLoading] = useState<Record<string, boolean>>({});
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [minimaxUserCode, setMinimaxUserCode] = useState<string | null>(null);
  const oauthPollingRef = useRef<Record<string, boolean>>({});

  const fetcher = useCallback(() => providerApi.list(), []);
  const { data, error, loading, refresh } = usePolling(fetcher, 3000);

  // Filter to only show configured providers in the table
  const configuredProviders = data?.providers.filter((p) => p.configured) ?? [];

  // Check OAuth provider status
  const getOAuthStatus = (providerName: string) => {
    const provider = data?.providers.find((p) => p.name === providerName);
    return provider?.configured ?? false;
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      oauthPollingRef.current = {};
    };
  }, []);

  // OAuth handlers
  async function handleOAuthLogin(providerName: string) {
    setOauthLoading((prev) => ({ ...prev, [providerName]: true }));
    setOauthError(null);
    setMinimaxUserCode(null);
    try {
      const response = await oauthApi.start(providerName);

      if (providerName === "minimax-oauth" && response.userCode) {
        // MiniMax device code flow - show user code
        setMinimaxUserCode(response.userCode);
        if (response.verificationUri) {
          window.open(response.verificationUri, "_blank", "width=600,height=700");
        }
      } else if (response.authUrl) {
        // Standard OAuth flow - open auth URL
        window.open(response.authUrl, "_blank", "width=600,height=700");
      }

      // Start polling for completion
      oauthPollingRef.current[providerName] = true;
      pollOAuthStatus(providerName);
    } catch (err) {
      setOauthError(String(err));
      setOauthLoading((prev) => ({ ...prev, [providerName]: false }));
    }
  }

  async function pollOAuthStatus(providerName: string) {
    const maxAttempts = 60; // 5 minutes with 5s interval
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await oauthApi.getStatus(providerName);
        if (status.loggedIn) {
          oauthPollingRef.current[providerName] = false;
          setOauthLoading((prev) => ({ ...prev, [providerName]: false }));
          setMinimaxUserCode(null);
          refresh();
          return;
        }
      } catch {
        // Ignore polling errors
      }

      attempts++;
      if (attempts < maxAttempts && oauthPollingRef.current[providerName]) {
        setTimeout(poll, 5000);
      } else {
        oauthPollingRef.current[providerName] = false;
        setOauthLoading((prev) => ({ ...prev, [providerName]: false }));
        setMinimaxUserCode(null);
      }
    };

    setTimeout(poll, 3000); // Start after 3 seconds
  }

  async function handleOAuthLogout(providerName: string) {
    setOauthLoading((prev) => ({ ...prev, [providerName]: true }));
    setOauthError(null);
    try {
      await oauthApi.logout(providerName);
      refresh();
    } catch (err) {
      setOauthError(String(err));
    } finally {
      setOauthLoading((prev) => ({ ...prev, [providerName]: false }));
    }
  }

  async function handleToggleActive(provider: ProviderInfo) {
    setTogglingProvider(provider.name);
    try {
      await providerApi.toggle(provider.name, !provider.active);
      refresh();
    } catch (err) {
      console.error("Failed to toggle provider active state:", err);
    } finally {
      setTogglingProvider(null);
    }
  }

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("providers.title")}</h1>
          <p className="text-sm text-gray-400">
            {t("providers.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* OAuth Login/Logout Buttons */}
          {isLoopback && OAUTH_PROVIDERS.map((oauth) => {
            const isLoggedIn = getOAuthStatus(oauth.name);
            const isLoading = oauthLoading[oauth.name] ?? false;
            const colorClass = oauth.color === "green"
              ? "border-green-600 bg-green-600/10 text-green-400 hover:bg-green-600/20"
              : "border-purple-600 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20";

            return isLoggedIn ? (
              <button
                key={oauth.name}
                onClick={() => handleOAuthLogout(oauth.name)}
                disabled={isLoading}
                className="rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-50"
              >
                {isLoading ? "..." : `Logout ${oauth.label}`}
              </button>
            ) : (
              <button
                key={oauth.name}
                onClick={() => handleOAuthLogin(oauth.name)}
                disabled={isLoading}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${colorClass}`}
              >
                {isLoading ? t("providers.waiting") : `Login ${oauth.label}`}
              </button>
            );
          })}

          <div className="relative">
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!isLoopback}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isLoopback
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-700 text-gray-500"
              }`}
              title={
                isLoopback
                  ? t("providers.addProviderTitle")
                  : t("providers.localhostOnly")
              }
            >
              {t("providers.addProvider")}
            </button>
            {!isLoopback && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded bg-gray-800 p-2 text-xs text-gray-400 shadow-lg">
                {t("providers.localhostOnly")}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {oauthError && (
        <div className="mt-4">
          <ErrorBanner message={`OAuth error: ${oauthError}`} />
        </div>
      )}

      {/* MiniMax Device Code */}
      {minimaxUserCode && (
        <div className="mt-4 rounded-lg border border-purple-600 bg-purple-900/20 p-4">
          <p className="text-sm text-purple-300">
            Enter this code on MiniMax:
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-purple-400">
            {minimaxUserCode}
          </p>
          <p className="mt-2 text-xs text-purple-400">
            Waiting for authorization...
          </p>
        </div>
      )}

      {/* Empty state */}
      {configuredProviders.length === 0 && (
        <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
          <p className="text-gray-400">{t("providers.noProviders")}</p>
          <p className="mt-1 text-sm text-gray-500">
            {t("providers.clickToAdd")}
          </p>
        </div>
      )}

      {/* Provider Table */}
      {configuredProviders.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                <th className="px-4 py-3 font-medium">{t("providers.provider")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("providers.active")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("providers.agents")}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t("providers.totalTokens")}
                </th>
                <th className="px-4 py-3 font-medium text-right">{t("providers.totalCost")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("providers.today")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {configuredProviders.map((provider) => {
                const isToggling = togglingProvider === provider.name;
                const icon =
                  PROVIDER_ICONS[provider.name] ||
                  provider.name[0].toUpperCase();

                return (
                  <tr
                    key={provider.name}
                    className="bg-gray-900 transition-colors hover:bg-gray-800"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-sm font-bold text-white">
                          {icon}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/providers/${provider.name}`}
                            className="font-medium capitalize text-blue-400 hover:text-blue-300"
                          >
                            {PROVIDER_LABELS[provider.name] || provider.name}
                          </Link>
                          {provider.authType === "oauth" && (
                            <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-xs text-green-400">
                              OAuth
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(provider)}
                        disabled={isToggling}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                          provider.active ? "bg-green-600" : "bg-gray-600"
                        }`}
                        role="switch"
                        aria-checked={provider.active}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                            provider.active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {provider.agent_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {provider.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {formatCost(provider.total_cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {formatCost(provider.today_cost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AddProviderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    validated: boolean;
    error?: string;
  } | null>(null);

  const providers = [
    "openai",
    "anthropic",
    "google",
    "mistral",
    "deepseek",
    "moonshot",
    "zhipu",
    "zhipu-coding-plan",
    "minimax",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider || !apiKey) return;

    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const result = await providerApi.add(selectedProvider, apiKey);
      setValidationResult({ validated: result.validated, error: result.error });

      if (result.success) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">{t("providers.addProviderTitle")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              {t("providers.provider")}
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">{t("providers.selectProvider")}</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p] || p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              {t("providers.apiKey")}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="rounded bg-red-900/20 p-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {validationResult && (
            <div
              className={`rounded p-2 text-sm ${
                validationResult.validated
                  ? "bg-green-900/20 text-green-400"
                  : "bg-yellow-900/20 text-yellow-400"
              }`}
            >
              {validationResult.validated
                ? t("providers.validationSuccess")
                : t("providers.validationFailed", { error: validationResult.error })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProvider || !apiKey}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t("providers.testing") : t("providers.testAndSave")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

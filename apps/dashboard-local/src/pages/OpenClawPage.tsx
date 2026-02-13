import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  providerApi,
  openclawApi,
  oauthApi,
  type ProviderInfo,
  type OpenclawModels,
  type OpenclawConfigResponse,
} from "../lib/api";
import { useConnection } from "../contexts/ConnectionContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

function generateOpenclawConfig(
  proxyHost: string = "localhost:18900",
  agentName: string = ""
): OpenclawModels {
  // Simplified approach: single "agentgazer" provider pointing to proxy
  // AgentGazer handles all routing via cross-provider override
  const baseUrl = `http://${proxyHost}/agents/${agentName || "openclaw"}/agentgazer`;

  return {
    mode: "merge",
    providers: {
      agentgazer: {
        baseUrl,
        apiKey: "managed-by-agentgazer",
        api: "openai-completions",
        models: [
          { id: "agentgazer-proxy", name: "AgentGazer Proxy" },
        ],
      },
    },
  };
}

export default function OpenClawPage() {
  const { t } = useTranslation();
  const { isLoopback } = useConnection();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentConfig, setCurrentConfig] =
    useState<OpenclawConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [proxyHost, setProxyHost] = useState("localhost:18900");
  // Generate unique agent name with timestamp base36 for multi-machine differentiation
  const [agentName, setAgentName] = useState<string>(
    () => `openclaw-${Date.now().toString(36)}`
  );
  // OAuth state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPolling, setOauthPolling] = useState(false);
  // Add provider modal state
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [providersRes, configRes] = await Promise.all([
        providerApi.list(),
        openclawApi.getConfig(),
      ]);
      setProviders(providersRes.providers);
      setCurrentConfig(configRes);
    } catch (err) {
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const configuredProviders = providers.filter((p) => p.configured && p.active);
  const generatedConfig = generateOpenclawConfig(proxyHost, agentName);
  const primaryModel = "agentgazer/agentgazer-proxy";

  function handleApplyClick() {
    // Show confirmation modal before applying
    setShowConfirmModal(true);
  }

  async function handleConfirmApply() {
    setShowConfirmModal(false);
    setApplying(true);
    setError(null);
    setConfigSuccess(false);
    try {
      // Apply both config and default model in one call
      await openclawApi.updateConfig(generatedConfig, primaryModel);
      setConfigSuccess(true);
      // Reload to show updated current config
      await loadData(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setApplying(false);
    }
  }

  // OAuth handlers
  async function handleOAuthLogin() {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const { authUrl } = await oauthApi.start("openai-oauth");
      // Open auth URL in new window
      window.open(authUrl, "_blank", "width=600,height=700");
      // Start polling for completion
      setOauthPolling(true);
      pollOAuthStatus();
    } catch (err) {
      setOauthError(String(err));
      setOauthLoading(false);
    }
  }

  async function pollOAuthStatus() {
    const maxAttempts = 60; // 5 minutes with 5s interval
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await oauthApi.getStatus("openai-oauth");
        if (status.loggedIn) {
          setOauthPolling(false);
          setOauthLoading(false);
          // Reload providers to show updated status
          await loadData(false);
          return;
        }
      } catch {
        // Ignore polling errors
      }

      attempts++;
      if (attempts < maxAttempts && oauthPolling) {
        setTimeout(poll, 5000);
      } else {
        setOauthPolling(false);
        setOauthLoading(false);
      }
    };

    setTimeout(poll, 3000); // Start after 3 seconds
  }

  async function handleOAuthLogout() {
    setOauthLoading(true);
    setOauthError(null);
    try {
      await oauthApi.logout("openai-oauth");
      await loadData(false);
    } catch (err) {
      setOauthError(String(err));
    } finally {
      setOauthLoading(false);
    }
  }

  // Check if openai-oauth is configured
  const openaiOAuthProvider = providers.find((p) => p.name === "openai-oauth");
  const isOAuthLoggedIn = openaiOAuthProvider?.configured ?? false;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("openclaw.title")}</h1>
        <p className="text-sm text-gray-400">
          {t("openclaw.subtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!isLoopback && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/20 p-4 text-yellow-300">
          {t("openclaw.localhostOnly")}
        </div>
      )}

      {/* Prerequisites */}
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">{t("openclaw.prerequisites")}</h2>
        <ul className="space-y-3 text-sm text-gray-400">
          {/* API Key Providers */}
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {configuredProviders.filter(p => p.authType !== "oauth").length > 0 ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="text-yellow-400">○</span>
              )}
              <span>
                {configuredProviders.filter(p => p.authType !== "oauth").length > 0
                  ? t("openclaw.apiKeyProviders", { count: configuredProviders.filter(p => p.authType !== "oauth").length, providers: configuredProviders.filter(p => p.authType !== "oauth").map((p) => p.name).join(", ") })
                  : t("openclaw.noApiKeyProviders")}
              </span>
            </div>
            <button
              onClick={() => setShowAddProviderModal(true)}
              disabled={!isLoopback}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("openclaw.addProvider")}
            </button>
          </li>

          {/* OAuth Providers (OpenAI Codex) */}
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOAuthLoggedIn ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="text-yellow-400">○</span>
              )}
              <span>
                {isOAuthLoggedIn
                  ? t("openclaw.oauthLoggedIn")
                  : t("openclaw.oauthNotLoggedIn")}
              </span>
              {isOAuthLoggedIn && (
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
                  OAuth
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {isOAuthLoggedIn ? (
                <button
                  onClick={handleOAuthLogout}
                  disabled={oauthLoading || !isLoopback}
                  className="rounded bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-500 disabled:opacity-50"
                >
                  {t("openclaw.logout")}
                </button>
              ) : (
                <button
                  onClick={handleOAuthLogin}
                  disabled={oauthLoading || !isLoopback}
                  className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {oauthLoading
                    ? oauthPolling
                      ? t("openclaw.waiting")
                      : t("common.loading")
                    : t("openclaw.loginCodex")}
                </button>
              )}
            </div>
          </li>
          {oauthError && (
            <li className="text-red-400 text-xs pl-6">{oauthError}</li>
          )}
          {oauthPolling && (
            <li className="text-yellow-400 text-xs pl-6">
              {t("openclaw.completeAuth")}
            </li>
          )}

          {/* OpenClaw Installation */}
          <li className="flex items-center gap-2">
            <span className="text-gray-500">○</span>
            <span>
              {t("openclaw.openclawInstalled")} (
              <a
                href="https://openclaw.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                openclaw.ai
              </a>
              )
            </span>
          </li>
        </ul>
      </div>

      {/* Current Config */}
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">{t("openclaw.currentConfig")}</h2>
        <p className="mb-2 text-xs text-gray-500">{t("openclaw.configPath")}</p>
        {!currentConfig?.exists ? (
          <p className="text-sm text-gray-500">
            {t("openclaw.noConfigFile")}
          </p>
        ) : currentConfig.parseError ? (
          <div className="text-sm text-yellow-400">
            <p>{t("openclaw.invalidJson")}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-500">
                {t("openclaw.showRaw")}
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-400">
                {currentConfig.raw}
              </pre>
            </details>
          </div>
        ) : currentConfig.models ? (
          <pre className="overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
            {JSON.stringify({ models: currentConfig.models }, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">
            {t("openclaw.noModelsKey")}
          </p>
        )}
      </div>

      {/* Generated Config */}
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">
          {t("openclaw.generatedConfig")}
        </h2>
        <p className="mb-3 text-sm text-gray-400">
          {t("openclaw.generatedConfigDesc")}
        </p>

        {/* Proxy Host Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            {t("openclaw.proxyHost")}
          </label>
          <input
            type="text"
            value={proxyHost}
            onChange={(e) => setProxyHost(e.target.value)}
            placeholder="localhost:18900"
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("openclaw.proxyHostHelp")}
          </p>
        </div>

        {/* Agent Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            {t("openclaw.agentName")}
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="openclaw"
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("openclaw.agentNameHelp")}
          </p>
        </div>

        <pre className="overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
          {JSON.stringify({ models: generatedConfig }, null, 2)}
        </pre>
      </div>

      {/* Apply Configuration */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-white">{t("openclaw.applyConfig")}</h3>
            <p className="text-sm text-gray-400">
              {t("openclaw.applyConfigDesc", { model: primaryModel })}
            </p>
          </div>
          <button
            onClick={handleApplyClick}
            disabled={applying || !isLoopback || !agentName}
            className={`rounded-md px-6 py-2 font-medium transition-colors ${
              isLoopback && agentName
                ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                : "cursor-not-allowed bg-gray-700 text-gray-500"
            }`}
          >
            {applying ? t("openclaw.applying") : t("openclaw.applyButton")}
          </button>
        </div>
        {configSuccess && (
          <div className="mt-3 rounded-md border border-green-800 bg-green-900/20 p-2 text-center text-sm text-green-300">
            {t("openclaw.configSuccess")}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">{t("openclaw.afterApplying")}</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-gray-400">
          <li>{t("openclaw.step1")}</li>
          <li>{t("openclaw.step2")}</li>
          <li>{t("openclaw.step3")}</li>
          <li>{t("openclaw.step4", { agent: agentName || "openclaw" })}</li>
        </ol>
      </div>

      {/* Add Provider Modal */}
      {showAddProviderModal && (
        <AddProviderModal
          onClose={() => setShowAddProviderModal(false)}
          onSuccess={() => {
            setShowAddProviderModal(false);
            loadData(false);
          }}
        />
      )}

      {/* Confirm Apply Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-medium text-white">
              {t("openclaw.confirmTitle")}
            </h2>
            <div className="mb-4 space-y-3 text-sm">
              <div className="flex justify-between rounded bg-gray-800 p-3">
                <span className="text-gray-400">{t("openclaw.agentName")}</span>
                <span className="font-mono text-white">{agentName}</span>
              </div>
              <div className="flex justify-between rounded bg-gray-800 p-3">
                <span className="text-gray-400">{t("openclaw.proxyHost")}</span>
                <span className="font-mono text-white">{proxyHost}</span>
              </div>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              {t("openclaw.rememberAgent")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmApply}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("openclaw.apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI (GPT-4o, o1, o3)",
  anthropic: "Anthropic (Claude Opus, Sonnet, Haiku)",
  google: "Google (Gemini)",
  mistral: "Mistral (Mistral Large, Codestral)",
  deepseek: "DeepSeek (V3, R1)",
  moonshot: "Moonshot (Kimi K2.5)",
  zhipu: "Zhipu / Z.ai (GLM-4.7)",
  "zhipu-coding-plan": "Zhipu Coding Plan (GLM-4.7, Subscription)",
  minimax: "MiniMax (M2)",
};

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
          <h2 className="text-lg font-medium text-white">{t("openclaw.addProviderTitle")}</h2>
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
              {t("openclaw.provider")}
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">{t("openclaw.selectProvider")}</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p] || p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              {t("openclaw.apiKey")}
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
                ? t("openclaw.validationSuccess")
                : t("openclaw.validationFailed", { error: validationResult.error })}
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
              {loading ? t("openclaw.testing") : t("openclaw.testAndSave")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
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
  const { isLoopback } = useConnection();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentConfig, setCurrentConfig] =
    useState<OpenclawConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [proxyHost, setProxyHost] = useState("localhost:18900");
  const [agentName, setAgentName] = useState<string>("openclaw");
  // OAuth state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPolling, setOauthPolling] = useState(false);
  // Add provider modal state
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);

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

  async function handleApply() {
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
        <h1 className="text-2xl font-bold text-white">OpenClaw Integration</h1>
        <p className="text-sm text-gray-400">
          Configure OpenClaw to route LLM requests through AgentGazer proxy
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!isLoopback && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/20 p-4 text-yellow-300">
          Configuration is only available from localhost for security.
        </div>
      )}

      {/* Prerequisites */}
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">Prerequisites</h2>
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
                  ? `${configuredProviders.filter(p => p.authType !== "oauth").length} API key provider(s): ${configuredProviders.filter(p => p.authType !== "oauth").map((p) => p.name).join(", ")}`
                  : "No API key providers configured"}
              </span>
            </div>
            <button
              onClick={() => setShowAddProviderModal(true)}
              disabled={!isLoopback}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add Provider
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
                  ? "OpenAI Codex (OAuth) logged in"
                  : "OpenAI Codex (subscription, $0 cost)"}
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
                  Logout
                </button>
              ) : (
                <button
                  onClick={handleOAuthLogin}
                  disabled={oauthLoading || !isLoopback}
                  className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {oauthLoading
                    ? oauthPolling
                      ? "Waiting..."
                      : "Loading..."
                    : "Login OpenAI Codex"}
                </button>
              )}
            </div>
          </li>
          {oauthError && (
            <li className="text-red-400 text-xs pl-6">{oauthError}</li>
          )}
          {oauthPolling && (
            <li className="text-yellow-400 text-xs pl-6">
              Complete authorization in the browser window, then wait...
            </li>
          )}

          {/* OpenClaw Installation */}
          <li className="flex items-center gap-2">
            <span className="text-gray-500">○</span>
            <span>
              OpenClaw installed (
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
        <h2 className="mb-2 font-medium text-white">Current OpenClaw Config</h2>
        <p className="mb-2 text-xs text-gray-500">~/.openclaw/openclaw.json</p>
        {!currentConfig?.exists ? (
          <p className="text-sm text-gray-500">
            No OpenClaw config file found. A new one will be created.
          </p>
        ) : currentConfig.parseError ? (
          <div className="text-sm text-yellow-400">
            <p>Config file exists but has invalid JSON.</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-500">
                Show raw content
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
            Config exists but has no &quot;models&quot; key.
          </p>
        )}
      </div>

      {/* Generated Config */}
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">
          Generated Configuration
        </h2>
        <p className="mb-3 text-sm text-gray-400">
          This configuration will route your OpenClaw LLM requests through
          AgentGazer proxy.
        </p>

        {/* Proxy Host Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Proxy Host
          </label>
          <input
            type="text"
            value={proxyHost}
            onChange={(e) => setProxyHost(e.target.value)}
            placeholder="localhost:18900"
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            AgentGazer proxy address (use internal IP for network access, e.g., 192.168.1.100:18900)
          </p>
        </div>

        {/* Agent Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Agent Name
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="openclaw"
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Name used to identify this agent in AgentGazer dashboard
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
            <h3 className="font-medium text-white">Apply Configuration</h3>
            <p className="text-sm text-gray-400">
              Sets up AgentGazer proxy provider and default model ({primaryModel}).
            </p>
          </div>
          <button
            onClick={handleApply}
            disabled={applying || !isLoopback || !agentName}
            className={`rounded-md px-6 py-2 font-medium transition-colors ${
              isLoopback && agentName
                ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                : "cursor-not-allowed bg-gray-700 text-gray-500"
            }`}
          >
            {applying ? "Applying..." : "Apply Configuration"}
          </button>
        </div>
        {configSuccess && (
          <div className="mt-3 rounded-md border border-green-800 bg-green-900/20 p-2 text-center text-sm text-green-300">
            Configuration applied successfully! Please restart OpenClaw to load the new settings.
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-medium text-white">After Applying</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-gray-400">
          <li>Restart OpenClaw to load the new configuration</li>
          <li>
            Send a test message through OpenClaw (Discord, Telegram, etc.)
          </li>
          <li>Check the Agents page to see your OpenClaw agent appear</li>
          <li>
            Go to <span className="text-white">Agents → {agentName || "openclaw"} → Model Settings</span> and configure the <span className="text-white">agentgazer</span> provider with your desired model and target provider
          </li>
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
  minimax: "MiniMax (M2)",
};

function AddProviderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
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
          <h2 className="text-lg font-medium text-white">Add Provider</h2>
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
              Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">Select a provider...</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p] || p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              API Key
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
                ? "API key validated successfully! Provider saved."
                : `Provider saved, but validation failed: ${validationResult.error}`}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProvider || !apiKey}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Testing..." : "Test & Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

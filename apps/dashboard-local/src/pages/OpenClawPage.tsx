import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  providerApi,
  openclawApi,
  type ProviderInfo,
  type OpenclawModels,
  type OpenclawConfigResponse,
} from "../lib/api";
import { useConnection } from "../contexts/ConnectionContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

// Model lists per provider - keep in sync with packages/shared/src/models.ts
const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  anthropic: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  cohere: ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024", "command-r7b-12-2024"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2.5", "kimi-k2-thinking"],
  zhipu: ["glm-4.7", "glm-4.7-flash", "glm-4.5", "glm-4.5-flash"],
  minimax: ["MiniMax-M2.1", "MiniMax-M2.1-lightning", "MiniMax-M2", "M2-her"],
};

// Map AgentGazer provider names to OpenClaw API types
// Valid values: openai-completions, openai-responses, anthropic-messages,
//               google-generative-ai, github-copilot, bedrock-converse-stream
const PROVIDER_API_MAP: Record<string, string> = {
  anthropic: "anthropic-messages",
  openai: "openai-completions",
  google: "google-generative-ai",  // Uses Google's native Generative AI API
  // All other providers use OpenAI-compatible API
  mistral: "openai-completions",
  cohere: "openai-completions",
  deepseek: "openai-completions",
  moonshot: "openai-completions",
  zhipu: "openai-completions",
  minimax: "openai-completions",
};

function generateOpenclawConfig(
  providers: ProviderInfo[],
  proxyPort: number = 18900,
  agentName: string = ""
): OpenclawModels {
  const configuredProviders = providers.filter((p) => p.configured && p.active);

  const providersConfig: Record<string, Record<string, unknown>> = {};

  for (const provider of configuredProviders) {
    const apiType = PROVIDER_API_MAP[provider.name] || "openai-completions";
    // Use /agents/{agentName}/{provider} format if agentName is provided
    const baseUrl = agentName
      ? `http://localhost:${proxyPort}/agents/${agentName}/${provider.name}`
      : `http://localhost:${proxyPort}/${provider.name}`;
    const modelIds = PROVIDER_MODELS[provider.name] || [];
    const models = modelIds.map((id) => ({ id, name: id }));

    providersConfig[`${provider.name}-traced`] = {
      baseUrl,
      apiKey: "managed-by-agentgazer",
      api: apiType,
      models,
    };
  }

  return {
    mode: "merge",
    providers: providersConfig,
  };
}

export default function OpenClawPage() {
  const { isLoopback } = useConnection();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentConfig, setCurrentConfig] =
    useState<OpenclawConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyingModel, setApplyingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [modelSuccess, setModelSuccess] = useState(false);
  const [proxyPort] = useState(18900); // Could be made configurable
  const [agentName, setAgentName] = useState<string>("openclaw");
  const [primaryModel, setPrimaryModel] = useState<string>("");
  const [copied, setCopied] = useState(false);

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
      // Set initial model value from config if available
      if (configRes.agents?.defaults?.model?.primary) {
        setPrimaryModel(configRes.agents.defaults.model.primary);
      }
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
  const generatedConfig = generateOpenclawConfig(providers, proxyPort, agentName);

  // Generate model options for dropdowns
  const modelOptions: { value: string; label: string }[] = [];
  for (const provider of configuredProviders) {
    const alias = `${provider.name}-traced`;
    const models = PROVIDER_MODELS[provider.name] || [];
    for (const model of models) {
      modelOptions.push({
        value: `${alias}/${model}`,
        label: `${alias}/${model}`,
      });
    }
  }

  async function handleApplyModel() {
    if (!primaryModel) return;
    setApplyingModel(true);
    setError(null);
    setModelSuccess(false);
    try {
      await openclawApi.updateDefaultModel(primaryModel);
      setModelSuccess(true);
      await loadData(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setApplyingModel(false);
    }
  }

  function handleCopyCommand() {
    const command = `openclaw config set agents.defaults.model.primary "${primaryModel}"`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApply() {
    setApplying(true);
    setError(null);
    setConfigSuccess(false);
    try {
      await openclawApi.updateConfig(generatedConfig);
      setConfigSuccess(true);
      // Reload to show updated current config
      await loadData(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setApplying(false);
    }
  }

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
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {configuredProviders.length > 0 ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="text-yellow-400">○</span>
              )}
              <span>
                {configuredProviders.length > 0
                  ? `${configuredProviders.length} provider(s) configured: ${configuredProviders.map((p) => p.name).join(", ")}`
                  : "No providers configured"}
              </span>
            </div>
            <Link
              to="/providers"
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Add Provider
            </Link>
          </li>
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
          AgentGazer proxy (port {proxyPort}).
        </p>

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

        {configuredProviders.length === 0 ? (
          <div className="rounded bg-gray-900 p-4 text-center text-sm text-gray-500">
            No providers configured. Please add providers first.
          </div>
        ) : (
          <pre className="overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
            {JSON.stringify({ models: generatedConfig }, null, 2)}
          </pre>
        )}
      </div>

      {/* Step 2: Default Model Selection */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-1 font-medium text-white">Step 2: Set Default Model</h2>
        <p className="mb-4 text-sm text-gray-400">
          Choose which model OpenClaw should use by default.
        </p>

        {configuredProviders.length === 0 ? (
          <p className="text-sm text-gray-500">
            Configure providers first to select a default model.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Primary Model */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Default Model
              </label>
              <select
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a model...</option>
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyModel}
              disabled={applyingModel || !isLoopback || !primaryModel}
              className={`w-full rounded-md px-4 py-2 font-medium transition-colors ${
                isLoopback && primaryModel
                  ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  : "cursor-not-allowed bg-gray-700 text-gray-500"
              }`}
            >
              {applyingModel ? "Applying..." : "Apply Default Model"}
            </button>

            {modelSuccess && (
              <div className="rounded-md border border-green-800 bg-green-900/20 p-2 text-center text-sm text-green-300">
                Default model applied successfully!
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 text-gray-500">
              <div className="flex-1 border-t border-gray-700" />
              <span className="text-xs">or run manually</span>
              <div className="flex-1 border-t border-gray-700" />
            </div>

            {/* CLI Command */}
            {primaryModel && (
              <div className="relative rounded bg-gray-900 p-3">
                <pre className="overflow-auto text-xs text-gray-300">
{`openclaw config set agents.defaults.model.primary "${primaryModel}"`}
                </pre>
                <button
                  onClick={handleCopyCommand}
                  className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Apply Configuration */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-white">Apply Configuration</h3>
            <p className="text-sm text-gray-400">
              {currentConfig?.exists
                ? "Updates only the 'models' key, preserving other settings."
                : "Creates ~/.openclaw/openclaw.json with the generated config."}
            </p>
          </div>
          <button
            onClick={handleApply}
            disabled={
              applying || !isLoopback || configuredProviders.length === 0
            }
            className={`rounded-md px-6 py-2 font-medium transition-colors ${
              isLoopback && configuredProviders.length > 0
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
        </ol>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { providerApi, type ProviderInfo } from "../lib/api";
import { useConnection } from "../contexts/ConnectionContext";

const PROVIDER_ICONS: Record<string, string> = {
  openai: "O",
  anthropic: "A",
  google: "G",
  mistral: "M",
  cohere: "C",
  deepseek: "D",
  moonshot: "m",
  zhipu: "Z",
  minimax: "X",
  baichuan: "B",
  yi: "Y",
};

export default function ProvidersPage() {
  const { isLoopback } = useConnection();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    try {
      setLoading(true);
      const data = await providerApi.list();
      setProviders(data.providers);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/20 p-4 text-red-400">
        Error loading providers: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Providers</h1>
          <p className="text-sm text-gray-400">Manage LLM provider connections and settings</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!isLoopback}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isLoopback
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-700 text-gray-500"
            }`}
            title={isLoopback ? "Add a new provider" : "Only available from localhost for API key security"}
          >
            + Add Provider
          </button>
          {!isLoopback && (
            <div className="absolute right-0 top-full mt-1 w-64 rounded bg-gray-800 p-2 text-xs text-gray-400 shadow-lg">
              Only available from localhost for API key security
            </div>
          )}
        </div>
      </div>

      {/* Provider Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {providers
          .filter((provider) => provider.configured)
          .map((provider) => (
            <ProviderCard key={provider.name} provider={provider} />
          ))}
      </div>

      {/* Empty state */}
      {providers.filter((p) => p.configured).length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-400">No providers configured yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Click "Add Provider" to get started.
          </p>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadProviders();
          }}
        />
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderInfo }) {
  const icon = PROVIDER_ICONS[provider.name] || provider.name[0].toUpperCase();

  return (
    <Link
      to={`/providers/${provider.name}`}
      className="group rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700 hover:bg-gray-800"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-white group-hover:bg-gray-700">
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium capitalize text-white">{provider.name}</h3>
            {/* Status badge */}
            {provider.active ? (
              <span className="inline-flex items-center rounded-full bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-400">
                Inactive
              </span>
            )}
          </div>

          {/* Rate limit info */}
          {provider.rate_limit && (
            <p className="mt-1 text-xs text-gray-500">
              Rate limit: {provider.rate_limit.max_requests}/{provider.rate_limit.window_seconds}s
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

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
    "cohere",
    "deepseek",
    "moonshot",
    "zhipu",
    "minimax",
    "baichuan",
    "yi",
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
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">Select a provider...</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">API Key</label>
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
            <div className="rounded bg-red-900/20 p-2 text-sm text-red-400">{error}</div>
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

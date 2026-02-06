import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface ProviderInfo {
  provider: string;
  model_override: string | null;
}

interface ModelSettingsProps {
  agentId: string;
}

export default function ModelSettings({ agentId }: ModelSettingsProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectableModels, setSelectableModels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track pending (unsaved) changes per provider
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | null>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [providersRes, modelsRes] = await Promise.all([
          api.get<{ providers: ProviderInfo[] }>(`/api/agents/${encodeURIComponent(agentId)}/providers`),
          api.get<Record<string, string[]>>("/api/models"),
        ]);
        setProviders(providersRes.providers);
        setSelectableModels(modelsRes);
        setPendingChanges({});
        setError(null);
      } catch (err) {
        setError("Failed to load model settings");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [agentId]);

  function handleDropdownChange(provider: string, model: string | null) {
    setPendingChanges((prev) => ({
      ...prev,
      [provider]: model,
    }));
  }

  async function handleApply(provider: string) {
    const model = pendingChanges[provider];
    if (model === undefined) return;

    setSaving(provider);
    try {
      if (model) {
        await api.put(`/api/agents/${encodeURIComponent(agentId)}/model-rules/${encodeURIComponent(provider)}`, {
          model_override: model,
        });
      } else {
        await api.del(`/api/agents/${encodeURIComponent(agentId)}/model-rules/${encodeURIComponent(provider)}`);
      }
      // Update saved state
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === provider ? { ...p, model_override: model } : p
        )
      );
      // Clear pending change for this provider
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
      setError(null);
    } catch (err) {
      setError("Failed to update model override");
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  function handleCancel(provider: string) {
    setPendingChanges((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">Model Settings</h2>
        <p className="mt-2 text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">Model Settings</h2>
        <p className="mt-2 text-sm text-gray-400">
          No providers detected yet. Make some LLM calls through the proxy to see provider options here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300">Model Settings</h2>
      <p className="mt-1 text-xs text-gray-500">
        Override the model for requests to each provider. The agent's original model request will be replaced.
      </p>

      {error && (
        <div className="mt-2 rounded bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {providers.map((p) => {
          const models = selectableModels[p.provider] ?? [];
          const isSaving = saving === p.provider;
          const hasPendingChange = p.provider in pendingChanges;
          const displayValue = hasPendingChange ? pendingChanges[p.provider] : p.model_override;

          return (
            <div
              key={p.provider}
              className="rounded-lg border border-gray-600 bg-gray-900 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium capitalize text-white">
                    {p.provider}
                  </span>
                  {p.model_override && !hasPendingChange && (
                    <span className="ml-2 rounded bg-indigo-900 px-2 py-0.5 text-xs text-indigo-200">
                      Override active
                    </span>
                  )}
                  {hasPendingChange && (
                    <span className="ml-2 rounded bg-yellow-900 px-2 py-0.5 text-xs text-yellow-200">
                      Unsaved
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <label className="text-xs text-gray-400">Model Override</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="block flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    value={displayValue ?? ""}
                    onChange={(e) => handleDropdownChange(p.provider, e.target.value || null)}
                    disabled={isSaving}
                  >
                    <option value="">None (use agent default)</option>
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {hasPendingChange && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApply(p.provider)}
                        disabled={isSaving}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {isSaving ? "Applying..." : "Apply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(p.provider)}
                        disabled={isSaving}
                        className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

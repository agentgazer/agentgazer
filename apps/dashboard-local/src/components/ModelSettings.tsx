import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

interface ProviderInfo {
  provider: string;
  default_model: string | null;
  model_override: string | null;
  target_provider: string | null;
}

interface ProviderStatus {
  name: string;
  configured: boolean;
}

interface ModelSettingsProps {
  agentId: string;
}

// Provider display names for grouping
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  moonshot: "Moonshot",
  zhipu: "Zhipu",
  "zhipu-coding-plan": "Zhipu Coding Plan",
  minimax: "MiniMax",
  baichuan: "Baichuan",
};

// Parse "provider:model" format or plain model name
function parseModelValue(value: string | null, defaultProvider: string): { provider: string; model: string } | null {
  if (!value) return null;
  if (value.includes(":")) {
    const [provider, ...modelParts] = value.split(":");
    return { provider, model: modelParts.join(":") };
  }
  // Plain model name - use default provider
  return { provider: defaultProvider, model: value };
}

export default function ModelSettings({ agentId }: ModelSettingsProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectableModels, setSelectableModels] = useState<Record<string, string[]>>({});
  const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track pending (unsaved) changes per provider: { provider: "targetProvider:model" | null }
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | null>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [providersRes, modelsRes, providerStatusRes] = await Promise.all([
          api.get<{ providers: ProviderInfo[] }>(`/api/agents/${encodeURIComponent(agentId)}/providers`),
          api.get<Record<string, string[]>>("/api/models"),
          api.get<{ providers: ProviderStatus[] }>("/api/providers"),
        ]);
        setProviders(providersRes.providers);
        setSelectableModels(modelsRes);
        // Build set of providers that have API keys configured
        const configured = new Set(
          providerStatusRes.providers
            .filter((p) => p.configured)
            .map((p) => p.name)
        );
        setConfiguredProviders(configured);
        setPendingChanges({});
        setError(null);
      } catch (err) {
        setError(t("modelSettings.loadFailed"));
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [agentId]);

  function handleDropdownChange(originalProvider: string, value: string | null) {
    setPendingChanges((prev) => ({
      ...prev,
      [originalProvider]: value,
    }));
  }

  async function handleApply(originalProvider: string) {
    const value = pendingChanges[originalProvider];
    if (value === undefined) return;

    setSaving(originalProvider);
    try {
      if (value) {
        const parsed = parseModelValue(value, originalProvider);
        if (parsed) {
          const targetProvider = parsed.provider !== originalProvider ? parsed.provider : null;
          await api.put(`/api/agents/${encodeURIComponent(agentId)}/model-rules/${encodeURIComponent(originalProvider)}`, {
            model_override: parsed.model,
            target_provider: targetProvider,
          });
          // Update saved state
          setProviders((prev) =>
            prev.map((p) =>
              p.provider === originalProvider
                ? { ...p, model_override: parsed.model, target_provider: targetProvider }
                : p
            )
          );
        }
      } else {
        await api.del(`/api/agents/${encodeURIComponent(agentId)}/model-rules/${encodeURIComponent(originalProvider)}`);
        // Update saved state
        setProviders((prev) =>
          prev.map((p) =>
            p.provider === originalProvider
              ? { ...p, model_override: null, target_provider: null }
              : p
          )
        );
      }
      // Clear pending change for this provider
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[originalProvider];
        return next;
      });
      setError(null);
    } catch (err) {
      setError(t("modelSettings.updateFailed"));
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

  // Get the current display value for a provider
  function getDisplayValue(p: ProviderInfo): string {
    if (p.provider in pendingChanges) {
      return pendingChanges[p.provider] ?? "";
    }
    if (p.model_override) {
      if (p.target_provider && p.target_provider !== p.provider) {
        return `${p.target_provider}:${p.model_override}`;
      }
      return p.model_override;
    }
    return "";
  }

  // Check if cross-provider override is active
  function isCrossProvider(p: ProviderInfo): boolean {
    const value = getDisplayValue(p);
    if (!value) return false;
    const parsed = parseModelValue(value, p.provider);
    return parsed ? parsed.provider !== p.provider : false;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">{t("modelSettings.title")}</h2>
        <p className="mt-2 text-sm text-gray-400">{t("modelSettings.loading")}</p>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">{t("modelSettings.title")}</h2>
        <p className="mt-2 text-sm text-gray-400">
          {t("modelSettings.noProviders")}
        </p>
      </div>
    );
  }

  // Get sorted list of providers that have models AND have API keys configured
  const allProviders = Object.keys(selectableModels)
    .filter((p) => configuredProviders.has(p))
    .sort((a, b) => {
      const nameA = PROVIDER_DISPLAY_NAMES[a] ?? a;
      const nameB = PROVIDER_DISPLAY_NAMES[b] ?? b;
      return nameA.localeCompare(nameB);
    });

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300">{t("modelSettings.title")}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {t("modelSettings.description")}
      </p>

      {error && (
        <div className="mt-2 rounded bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {providers.map((p) => {
          const isSaving = saving === p.provider;
          const hasPendingChange = p.provider in pendingChanges;
          const displayValue = getDisplayValue(p);
          const crossProvider = isCrossProvider(p);

          return (
            <div
              key={p.provider}
              className="rounded-lg border border-gray-600 bg-gray-900 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium capitalize text-white">
                    {PROVIDER_DISPLAY_NAMES[p.provider] ?? p.provider}
                  </span>
                  {p.default_model && (
                    <span className="ml-2 text-xs text-gray-400">
                      {t("modelSettings.fromDefault", { model: p.default_model })}
                    </span>
                  )}
                  {displayValue && !hasPendingChange && (
                    <span className={`ml-2 rounded px-2 py-0.5 text-xs ${
                      crossProvider
                        ? "bg-purple-900 text-purple-200"
                        : "bg-indigo-900 text-indigo-200"
                    }`}>
                      {crossProvider ? t("modelSettings.crossProviderOverride") : t("modelSettings.overrideActive")}
                    </span>
                  )}
                  {hasPendingChange && (
                    <span className="ml-2 rounded bg-yellow-900 px-2 py-0.5 text-xs text-yellow-200">
                      {t("modelSettings.unsaved")}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <label className="text-xs text-gray-400">{t("modelSettings.modelOverride")}</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="block flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    value={displayValue}
                    onChange={(e) => handleDropdownChange(p.provider, e.target.value || null)}
                    disabled={isSaving}
                  >
                    <option value="">{t("modelSettings.noneDefault")}</option>
                    {allProviders.map((providerKey) => {
                      const models = selectableModels[providerKey] ?? [];
                      if (models.length === 0) return null;
                      const providerName = PROVIDER_DISPLAY_NAMES[providerKey] ?? providerKey;
                      const isSameProvider = providerKey === p.provider;

                      return (
                        <optgroup key={providerKey} label={providerName}>
                          {models.map((model) => {
                            // Use plain model name for same provider, "provider:model" for cross-provider
                            const optionValue = isSameProvider ? model : `${providerKey}:${model}`;
                            return (
                              <option key={optionValue} value={optionValue}>
                                {model}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </select>
                  {hasPendingChange && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApply(p.provider)}
                        disabled={isSaving}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {isSaving ? t("modelSettings.applying") : t("modelSettings.apply")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(p.provider)}
                        disabled={isSaving}
                        className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        {t("modelSettings.cancel")}
                      </button>
                    </>
                  )}
                </div>
                {crossProvider && !hasPendingChange && (
                  <p className="mt-1 text-xs text-purple-400">
                    {t("modelSettings.routedTo", { provider: PROVIDER_DISPLAY_NAMES[p.target_provider ?? ""] ?? p.target_provider })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

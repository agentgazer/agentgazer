import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  providerApi,
  type ProviderSettings,
  type ProviderModel,
  type ProviderStats,
} from "../lib/api";

const TIME_RANGES = [
  { label: "1h", value: "1h", ms: 60 * 60 * 1000 },
  { label: "24h", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30d", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
];

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ProviderDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [_settings, setSettings] = useState<ProviderSettings | null>(null);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Settings form state
  const [active, setActive] = useState(true);
  const [rateLimitEnabled, setRateLimitEnabled] = useState(false);
  const [maxRequests, setMaxRequests] = useState(100);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);

  // Model form state
  const [newModelId, setNewModelId] = useState("");
  const [testingModel, setTestingModel] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (name) loadData();
  }, [name, timeRange]);

  async function loadData() {
    if (!name) return;
    try {
      setLoading(true);
      const [settingsRes, modelsRes, statsRes] = await Promise.all([
        providerApi.getSettings(name),
        providerApi.getModels(name),
        providerApi.getStats(
          name,
          new Date(Date.now() - TIME_RANGES.find((r) => r.value === timeRange)!.ms).toISOString()
        ),
      ]);

      setSettings(settingsRes);
      setModels(modelsRes.models);
      setStats(statsRes);

      // Initialize form state
      setActive(settingsRes.active);
      setRateLimitEnabled(!!settingsRes.rate_limit);
      if (settingsRes.rate_limit) {
        setMaxRequests(settingsRes.rate_limit.max_requests);
        setWindowSeconds(settingsRes.rate_limit.window_seconds);
      }

      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!name) return;
    setSavingSettings(true);
    try {
      await providerApi.updateSettings(name, {
        active,
        rate_limit: rateLimitEnabled ? { max_requests: maxRequests, window_seconds: windowSeconds } : null,
      });
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleToggleActive() {
    if (!name) return;
    const newActive = !active;
    setActive(newActive); // Optimistic update
    setSavingSettings(true);
    try {
      await providerApi.updateSettings(name, { active: newActive });
      await loadData();
    } catch (err) {
      setActive(!newActive); // Revert on error
      setError(String(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleTestConnection() {
    if (!name) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await providerApi.validate(name);
      setValidationResult(result);
    } catch (err) {
      setValidationResult({ valid: false, error: String(err) });
    } finally {
      setValidating(false);
    }
  }

  async function handleTestModel() {
    if (!name || !newModelId.trim()) return;
    setTestingModel(true);
    setModelTestResult(null);
    try {
      const result = await providerApi.testModel(name, newModelId.trim());
      if (result.exists) {
        setModelTestResult({ success: true });
        setNewModelId("");
        await loadData();
      } else {
        setModelTestResult({ success: false, error: result.error || "Model not found" });
      }
    } catch (err) {
      setModelTestResult({ success: false, error: String(err) });
    } finally {
      setTestingModel(false);
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!name) return;
    try {
      await providerApi.removeModel(name, modelId);
      await loadData();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteProvider() {
    if (!name) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete provider "${name}"?\n\nThis will remove the API key and all provider settings.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await providerApi.remove(name);
      navigate("/providers");
    } catch (err) {
      setError(String(err));
      setDeleting(false);
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
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/providers" className="text-gray-400 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold capitalize text-white">{name}</h1>
            <p className="text-sm text-gray-400">Provider configuration and statistics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={validating}
            className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {validating ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleDeleteProvider}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Provider"}
          </button>
        </div>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div
          className={`rounded-lg p-3 ${
            validationResult.valid ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"
          }`}
        >
          {validationResult.valid ? "Connection successful!" : `Connection failed: ${validationResult.error}`}
        </div>
      )}

      {/* Settings Section */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-medium text-white">Settings</h2>
        <div className="space-y-4">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-white">Active</label>
              <p className="text-sm text-gray-400">Deactivated providers block all requests (takes ~5s to take effect)</p>
            </div>
            <button
              onClick={handleToggleActive}
              disabled={savingSettings}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                active ? "bg-blue-600" : "bg-gray-600"
              } ${savingSettings ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Rate Limit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-white">Rate Limit</label>
                <p className="text-sm text-gray-400">Limit requests per time window</p>
              </div>
              <button
                onClick={() => setRateLimitEnabled(!rateLimitEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rateLimitEnabled ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rateLimitEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {rateLimitEnabled && (
              <div className="mt-2 flex gap-4">
                <div>
                  <label className="block text-sm text-gray-400">Max Requests</label>
                  <input
                    type="number"
                    value={maxRequests}
                    onChange={(e) => setMaxRequests(Number(e.target.value))}
                    className="mt-1 w-24 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-white"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400">Window (seconds)</label>
                  <input
                    type="number"
                    value={windowSeconds}
                    onChange={(e) => setWindowSeconds(Number(e.target.value))}
                    className="mt-1 w-24 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-white"
                    min={1}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Models Section */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-medium text-white">Models</h2>

        {/* Add Model */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            placeholder="Enter model ID (e.g., gpt-4o-mini)"
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
          />
          <button
            onClick={handleTestModel}
            disabled={testingModel || !newModelId.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {testingModel ? "Testing..." : "Test & Add"}
          </button>
        </div>

        {modelTestResult && (
          <div
            className={`mb-4 rounded p-2 text-sm ${
              modelTestResult.success ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"
            }`}
          >
            {modelTestResult.success ? "Model verified and added!" : `Failed: ${modelTestResult.error}`}
          </div>
        )}

        {/* Models List */}
        <div className="space-y-2">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between rounded border border-gray-800 bg-gray-800/50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-white">{model.id}</span>
                {model.verified && (
                  <span className="rounded-full bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
                    Verified
                  </span>
                )}
                {model.custom && (
                  <span className="rounded-full bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">
                    Custom
                  </span>
                )}
              </div>
              {model.custom && (
                <button
                  onClick={() => handleDeleteModel(model.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {models.length === 0 && (
            <p className="text-center text-gray-500">No models available</p>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Usage Statistics</h2>
          <div className="flex gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`rounded px-3 py-1 text-sm ${
                  timeRange === range.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Requests" value={stats?.total_requests ?? 0} />
          <StatCard
            label="Total Tokens"
            value={stats?.total_tokens ?? 0}
            format={(v) => v.toLocaleString()}
          />
          <StatCard
            label="Total Cost"
            value={stats?.total_cost ?? 0}
            format={(v) => `$${v.toFixed(4)}`}
          />
        </div>

        {/* Cost by Model Chart */}
        {stats?.by_model && stats.by_model.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-400">Cost by Model</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.by_model}
                    dataKey="cost"
                    nameKey="model"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ model, cost }) => `${model}: $${cost.toFixed(4)}`}
                  >
                    {stats.by_model.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{format ? format(value) : value}</p>
    </div>
  );
}

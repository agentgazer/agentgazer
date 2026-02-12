import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

/* ---------- Types ---------- */

interface PayloadStats {
  enabled: boolean;
  archive: number;
  evidence: number;
  totalSize: number;
}

interface Settings {
  server?: {
    port?: number;
    proxyPort?: number;
    autoOpen?: boolean;
  };
  data?: {
    retentionDays?: number;
  };
  payload?: {
    enabled?: boolean;
    retentionDays?: number;
  };
  alerts?: {
    defaults?: {
      telegram?: {
        botToken?: string;
        chatId?: string;
      };
      webhook?: {
        url?: string;
      };
      email?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
        from?: string;
        to?: string;
      };
    };
  };
}

/* ---------- Component ---------- */

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialPorts, setInitialPorts] = useState<{ port?: number; proxyPort?: number }>({});

  // Form state
  const [port, setPort] = useState<number>(18880);
  const [proxyPort, setProxyPort] = useState<number>(18900);
  const [autoOpen, setAutoOpen] = useState<boolean>(true);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [payloadEnabled, setPayloadEnabled] = useState<boolean>(false);
  const [payloadRetentionDays, setPayloadRetentionDays] = useState<number>(7);
  const [payloadStats, setPayloadStats] = useState<PayloadStats | null>(null);
  const [clearingArchive, setClearingArchive] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [emailHost, setEmailHost] = useState<string>("");
  const [emailPort, setEmailPort] = useState<number>(587);
  const [emailSecure, setEmailSecure] = useState<boolean>(false);
  const [emailUser, setEmailUser] = useState<string>("");
  const [emailPass, setEmailPass] = useState<string>("");
  const [emailFrom, setEmailFrom] = useState<string>("");
  const [emailTo, setEmailTo] = useState<string>("");

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Settings>("/api/settings");

      // Fetch payload stats separately (non-critical, may fail if store not enabled)
      let stats: PayloadStats = { enabled: false, archive: 0, evidence: 0, totalSize: 0 };
      try {
        stats = await api.get<PayloadStats>("/api/payloads/stats");
      } catch {
        // Ignore payload stats fetch errors
      }

      // Initialize form state
      setPort(data.server?.port ?? 18880);
      setProxyPort(data.server?.proxyPort ?? 18900);
      setAutoOpen(data.server?.autoOpen ?? true);
      setRetentionDays(data.data?.retentionDays ?? 30);
      setPayloadEnabled(data.payload?.enabled ?? false);
      setPayloadRetentionDays(data.payload?.retentionDays ?? 7);
      setPayloadStats(stats);
      setTelegramBotToken(data.alerts?.defaults?.telegram?.botToken ?? "");
      setTelegramChatId(data.alerts?.defaults?.telegram?.chatId ?? "");
      setWebhookUrl(data.alerts?.defaults?.webhook?.url ?? "");
      setEmailHost(data.alerts?.defaults?.email?.host ?? "");
      setEmailPort(data.alerts?.defaults?.email?.port ?? 587);
      setEmailSecure(data.alerts?.defaults?.email?.secure ?? false);
      setEmailUser(data.alerts?.defaults?.email?.user ?? "");
      setEmailPass(data.alerts?.defaults?.email?.pass ?? "");
      setEmailFrom(data.alerts?.defaults?.email?.from ?? "");
      setEmailTo(data.alerts?.defaults?.email?.to ?? "");

      // Remember initial ports for restart warning
      setInitialPorts({
        port: data.server?.port,
        proxyPort: data.server?.proxyPort,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updates: Settings = {
        server: {
          port,
          proxyPort,
          autoOpen,
        },
        data: {
          retentionDays,
        },
        payload: {
          enabled: payloadEnabled,
          retentionDays: payloadRetentionDays,
        },
        alerts: {
          defaults: {
            telegram: telegramBotToken || telegramChatId
              ? { botToken: telegramBotToken, chatId: telegramChatId }
              : undefined,
            webhook: webhookUrl ? { url: webhookUrl } : undefined,
            email: emailHost || emailUser
              ? {
                  host: emailHost,
                  port: emailPort,
                  secure: emailSecure,
                  user: emailUser,
                  pass: emailPass,
                  from: emailFrom,
                  to: emailTo,
                }
              : undefined,
          },
        },
      };

      await api.put<Settings>("/api/settings", updates);

      // Check if ports changed
      const portsChanged =
        (initialPorts.port !== undefined && initialPorts.port !== port) ||
        (initialPorts.proxyPort !== undefined && initialPorts.proxyPort !== proxyPort);

      if (portsChanged) {
        setSuccess("Settings saved. Restart required for port changes to take effect.");
      } else {
        setSuccess("Settings saved successfully.");
      }

      // Update initial ports
      setInitialPorts({ port, proxyPort });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* Server Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Server</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dashboard Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 18880)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proxy Port
              </label>
              <input
                type="number"
                value={proxyPort}
                onChange={(e) => setProxyPort(parseInt(e.target.value, 10) || 18900)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoOpen}
                  onChange={(e) => setAutoOpen(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-open browser on start
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Data Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Data</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Retention Days
            </label>
            <input
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 30)}
              min={1}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Events older than this will be automatically deleted.
            </p>
          </div>
        </div>

        {/* Payload Storage Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Payload Storage</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Warning: Payload storage saves full request/response bodies. This may include sensitive data like API keys, user content, or PII. Use with caution.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={payloadEnabled}
                  onChange={(e) => setPayloadEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable payload archiving
                </span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Save request and response bodies for later analysis. Requires restart to take effect.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payload Retention Days
              </label>
              <input
                type="number"
                value={payloadRetentionDays}
                onChange={(e) => setPayloadRetentionDays(parseInt(e.target.value, 10) || 7)}
                min={1}
                disabled={!payloadEnabled}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Archived payloads older than this will be automatically deleted.
              </p>
            </div>
            {payloadStats && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Storage Statistics
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Archive:</span>{" "}
                    <span className="font-medium">{(payloadStats.archive ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Evidence:</span>{" "}
                    <span className="font-medium">{(payloadStats.evidence ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Size:</span>{" "}
                    <span className="font-medium">
                      {(payloadStats.totalSize ?? 0) > 1024 * 1024
                        ? `${((payloadStats.totalSize ?? 0) / (1024 * 1024)).toFixed(1)} MB`
                        : (payloadStats.totalSize ?? 0) > 1024
                        ? `${((payloadStats.totalSize ?? 0) / 1024).toFixed(1)} KB`
                        : `${payloadStats.totalSize ?? 0} B`}
                    </span>
                  </div>
                </div>
                {(payloadStats.archive ?? 0) > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm("Are you sure you want to clear all archived payloads? This cannot be undone.")) return;
                      setClearingArchive(true);
                      try {
                        await api.delete("/api/payloads/archive");
                        const stats = await api.get<PayloadStats>("/api/payloads/stats");
                        setPayloadStats(stats);
                        setSuccess("Archive cleared successfully.");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to clear archive");
                      } finally {
                        setClearingArchive(false);
                      }
                    }}
                    disabled={clearingArchive}
                    className="mt-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {clearingArchive ? "Clearing..." : "Clear Archive"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Alert Defaults Section */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Alert Defaults</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These values will be used as defaults when creating new alerts.
          </p>

          <div className="space-y-6">
            {/* Telegram */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telegram
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Bot Token
                  </label>
                  <input
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456789:ABC..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Chat ID
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="-100123456789"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Webhook */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook
              </h3>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Default URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Email SMTP */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email (SMTP)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={emailHost}
                    onChange={(e) => setEmailHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={emailPort}
                    onChange={(e) => setEmailPort(parseInt(e.target.value, 10) || 587)}
                    placeholder="587"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={emailPass}
                    onChange={(e) => setEmailPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    From Address
                  </label>
                  <input
                    type="email"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder="alerts@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    To Address
                  </label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={emailSecure}
                      onChange={(e) => setEmailSecure(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Use TLS/SSL (port 465)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Config file path */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Config file: ~/.agentgazer/config.json
      </div>
    </div>
  );
}

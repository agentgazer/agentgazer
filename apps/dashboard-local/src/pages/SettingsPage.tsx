import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

/* ---------- Types ---------- */

interface Settings {
  server?: {
    port?: number;
    proxyPort?: number;
    autoOpen?: boolean;
  };
  data?: {
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

      // Initialize form state
      setPort(data.server?.port ?? 18880);
      setProxyPort(data.server?.proxyPort ?? 18900);
      setAutoOpen(data.server?.autoOpen ?? true);
      setRetentionDays(data.data?.retentionDays ?? 30);
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

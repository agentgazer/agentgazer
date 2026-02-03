"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchKeys = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, created_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setKeys(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate a random API key
      const rawKey = `aw_${crypto.randomUUID().replace(/-/g, "")}`;
      const prefix = rawKey.slice(0, 8);

      // Hash the key with SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Insert into api_keys table
      const { error: insertError } = await supabase.from("api_keys").insert({
        user_id: user.id,
        name: newKeyName || "Untitled Key",
        key_hash: keyHash,
        key_prefix: prefix,
      });

      if (insertError) throw new Error(insertError.message);

      // Show the key to the user (only time it will be visible)
      setCreatedKey(rawKey);
      setNewKeyName("");
      setShowCreateForm(false);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    setError(null);

    const { error: updateError } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId);

    if (updateError) {
      setError(updateError.message);
    } else {
      await fetchKeys();
    }
  }

  async function copyToClipboard(text: string, id?: string) {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your API keys for agent authentication
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Generate New Key
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Created key alert - shown once */}
      {createdKey && (
        <div className="rounded-md border border-green-800 bg-green-950 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-green-300">
                API Key Created
              </h3>
              <p className="mt-1 text-xs text-green-400">
                Copy this key now. You will not be able to see it again.
              </p>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-green-400 hover:text-green-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded bg-gray-900 px-3 py-2 font-mono text-sm text-white">
              {createdKey}
            </code>
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="rounded-md bg-green-700 px-3 py-2 text-sm text-white hover:bg-green-600"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Create key form */}
      {showCreateForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <form onSubmit={handleCreateKey} className="flex items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="keyName"
                className="block text-sm font-medium text-gray-300"
              >
                Key Name
              </label>
              <input
                id="keyName"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production Agent"
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Keys list */}
      <div className="rounded-lg border border-gray-700 bg-gray-800">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">
            Loading keys...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key Prefix</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-gray-700 last:border-0"
                >
                  <td className="px-4 py-3 text-sm text-white">{key.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-gray-300">
                        {key.key_prefix}...
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(key.key_prefix, key.id)
                        }
                        className="text-gray-500 hover:text-gray-300"
                        title="Copy prefix"
                      >
                        {copiedId === key.id ? (
                          <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {key.revoked_at ? (
                      <span className="inline-flex items-center rounded-full bg-red-950 px-2 py-0.5 text-xs font-medium text-red-300">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-950 px-2 py-0.5 text-xs font-medium text-green-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!key.revoked_at && (
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

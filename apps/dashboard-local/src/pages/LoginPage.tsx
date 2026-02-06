import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function LoginPage() {
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post<{ ok: boolean }>("/api/auth/verify", { token });
      setToken(token);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-900 p-8 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-gray-100">AgentGazer</h1>
        <p className="mt-1 text-sm text-gray-400">Enter your token to continue</p>

        <label htmlFor="token" className="mt-6 block text-sm font-medium text-gray-300">
          Token
        </label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="paste token here"
          autoFocus
          required
        />

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Login"}
        </button>
      </form>
    </div>
  );
}

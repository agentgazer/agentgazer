import { readConfig } from "../config.js";

export interface ApiError {
  status: number;
  message: string;
}

export async function apiGet<T>(urlPath: string, port: number = 8080): Promise<T> {
  const config = readConfig();
  const token = config?.token ?? "";
  try {
    const res = await fetch(`http://localhost:${port}${urlPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const error: ApiError = { status: res.status, message: res.statusText };
      throw error;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (
      err instanceof TypeError &&
      (err as NodeJS.ErrnoException & { cause?: { code?: string } }).cause?.code === "ECONNREFUSED"
    ) {
      const error: ApiError = { status: 0, message: 'Server not running. Run "agentgazer start" first.' };
      throw error;
    }
    throw err;
  }
}

export async function apiPut<T>(urlPath: string, body: unknown, port: number = 8080): Promise<T> {
  const config = readConfig();
  const token = config?.token ?? "";
  try {
    const res = await fetch(`http://localhost:${port}${urlPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const error: ApiError = { status: res.status, message: res.statusText };
      throw error;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (
      err instanceof TypeError &&
      (err as NodeJS.ErrnoException & { cause?: { code?: string } }).cause?.code === "ECONNREFUSED"
    ) {
      const error: ApiError = { status: 0, message: 'Server not running. Run "agentgazer start" first.' };
      throw error;
    }
    throw err;
  }
}

export async function apiDelete<T>(urlPath: string, port: number = 8080): Promise<T> {
  const config = readConfig();
  const token = config?.token ?? "";
  try {
    const res = await fetch(`http://localhost:${port}${urlPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const error: ApiError = { status: res.status, message: res.statusText };
      throw error;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (
      err instanceof TypeError &&
      (err as NodeJS.ErrnoException & { cause?: { code?: string } }).cause?.code === "ECONNREFUSED"
    ) {
      const error: ApiError = { status: 0, message: 'Server not running. Run "agentgazer start" first.' };
      throw error;
    }
    throw err;
  }
}

export function handleApiError(err: unknown): never {
  if (err && typeof err === "object" && "message" in err) {
    console.error((err as ApiError).message);
  } else {
    console.error("An unexpected error occurred.");
  }
  process.exit(1);
}

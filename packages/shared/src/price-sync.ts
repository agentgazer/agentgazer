/**
 * Auto price sync from models.dev API
 * Fetches latest model pricing and merges with static pricing table.
 */

import type { ModelPricing } from "./pricing.js";

const MODELS_DEV_API_URL = "https://models.dev/api.json";

// Providers we care about from models.dev
const SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "mistral",
  "cohere",
  "zhipuai",
  "minimax",
  "moonshotai",
  "baichuan",
];

// In-memory synced prices (merged with static)
let syncedPrices: Record<string, ModelPricing> = {};
let lastSyncTime: number | null = null;
let lastSyncError: string | null = null;

export interface ModelsDevResponse {
  [provider: string]: {
    models: {
      [modelId: string]: {
        id: string;
        cost?: {
          input?: number;  // per 1M tokens
          output?: number; // per 1M tokens
        };
      };
    };
  };
}

export interface SyncResult {
  success: boolean;
  modelsUpdated: number;
  error?: string;
  timestamp: number;
}

/**
 * Fetch pricing data from models.dev API
 */
export async function fetchModelsDevPricing(): Promise<ModelsDevResponse> {
  const response = await fetch(MODELS_DEV_API_URL, {
    headers: {
      "User-Agent": "AgentGazer/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models.dev API: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ModelsDevResponse>;
}

/**
 * Parse models.dev response into our pricing format
 */
export function parseModelsDevResponse(data: ModelsDevResponse): Record<string, ModelPricing> {
  const prices: Record<string, ModelPricing> = {};

  for (const provider of SUPPORTED_PROVIDERS) {
    const providerData = data[provider];
    if (!providerData?.models) continue;

    for (const [, model] of Object.entries(providerData.models)) {
      const modelId = model.id?.toLowerCase();
      if (!modelId) continue;

      const cost = model.cost;
      if (!cost) continue;

      // Only include models with valid pricing
      const input = cost.input ?? 0;
      const output = cost.output ?? 0;

      // Skip if both are 0 (likely free tier or missing data)
      // But keep if explicitly 0 (like glm-4.7-flash)
      if (input === 0 && output === 0 && cost.input === undefined && cost.output === undefined) {
        continue;
      }

      prices[modelId] = {
        inputPerMToken: input,
        outputPerMToken: output,
      };
    }
  }

  return prices;
}

/**
 * Sync prices from models.dev API
 * Updates in-memory cache, does not modify static PRICING_TABLE
 */
export async function syncPrices(): Promise<SyncResult> {
  const timestamp = Date.now();

  try {
    const data = await fetchModelsDevPricing();
    const prices = parseModelsDevResponse(data);

    syncedPrices = prices;
    lastSyncTime = timestamp;
    lastSyncError = null;

    return {
      success: true,
      modelsUpdated: Object.keys(prices).length,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    lastSyncError = errorMsg;

    return {
      success: false,
      modelsUpdated: 0,
      error: errorMsg,
      timestamp,
    };
  }
}

/**
 * Get synced price for a model (returns null if not found)
 */
export function getSyncedPricing(model: string): ModelPricing | null {
  const normalized = model.toLowerCase();
  return syncedPrices[normalized] ?? null;
}

/**
 * Get all synced prices
 */
export function getAllSyncedPrices(): Record<string, ModelPricing> {
  return { ...syncedPrices };
}

/**
 * Get last sync status
 */
export function getSyncStatus(): {
  lastSyncTime: number | null;
  lastSyncError: string | null;
  modelCount: number;
} {
  return {
    lastSyncTime,
    lastSyncError,
    modelCount: Object.keys(syncedPrices).length,
  };
}

/**
 * Clear synced prices (for testing)
 */
export function clearSyncedPrices(): void {
  syncedPrices = {};
  lastSyncTime = null;
  lastSyncError = null;
}

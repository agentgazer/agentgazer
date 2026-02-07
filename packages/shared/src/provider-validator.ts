import { ProviderName, getProviderBaseUrl, getProviderAuthHeader } from "./providers.js";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  models?: string[];
}

/**
 * Validate an API key for a given provider.
 * Uses free endpoints where possible to avoid consuming tokens.
 */
export async function validateProviderKey(
  provider: ProviderName,
  apiKey: string,
): Promise<ValidationResult> {
  switch (provider) {
    case "openai":
      return validateOpenAI(apiKey);
    case "anthropic":
      return validateAnthropic(apiKey);
    case "google":
      return validateGoogle(apiKey);
    case "mistral":
      return validateMistral(apiKey);
    case "cohere":
      return validateCohere(apiKey);
    case "deepseek":
      return validateDeepSeek(apiKey);
    case "moonshot":
      return validateMoonshot(apiKey);
    case "zhipu":
      return validateZhipu(apiKey);
    case "minimax":
      return validateMinimax(apiKey);
    case "yi":
      return validateYi(apiKey);
    default:
      return { valid: false, error: `Validation not supported for provider: ${provider}` };
  }
}

/**
 * Test if a specific model exists for a provider.
 */
export async function testProviderModel(
  provider: ProviderName,
  apiKey: string,
  modelId: string,
): Promise<{ exists: boolean; error?: string }> {
  // For providers with /models endpoint, check if model is in list
  const result = await validateProviderKey(provider, apiKey);
  if (!result.valid) {
    return { exists: false, error: result.error };
  }

  if (result.models && result.models.length > 0) {
    const exists = result.models.some(m =>
      m.toLowerCase() === modelId.toLowerCase() ||
      m.includes(modelId) ||
      modelId.includes(m)
    );
    return { exists };
  }

  // For providers without models list, try a minimal request
  return testModelWithMinimalRequest(provider, apiKey, modelId);
}

// ---------------------------------------------------------------------------
// Provider-specific validation
// ---------------------------------------------------------------------------

async function validateOpenAI(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateAnthropic(apiKey: string): Promise<ValidationResult> {
  // Anthropic doesn't have a free /models endpoint, so we send a minimal request
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (res.status === 400) {
      const data = await res.json() as { error?: { message?: string } };
      return { valid: false, error: data.error?.message ?? "Bad request" };
    }
    // 200 or 429 (rate limit) means key is valid
    if (res.ok || res.status === 429) {
      return { valid: true };
    }

    return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateGoogle(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
    );

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { models: { name: string }[] };
    const models = data.models?.map(m => m.name.replace("models/", "")) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateMistral(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateCohere(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch("https://api.cohere.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { models: { name: string }[] };
    const models = data.models?.map(m => m.name) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateDeepSeek(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch("https://api.deepseek.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateMoonshot(apiKey: string): Promise<ValidationResult> {
  // Try international endpoint first (api.moonshot.ai), fallback to China (api.moonshot.cn)
  try {
    let res = await fetch("https://api.moonshot.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // If international fails with 401, try China endpoint
    if (res.status === 401) {
      res = await fetch("https://api.moonshot.cn/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateZhipu(apiKey: string): Promise<ValidationResult> {
  // Try international endpoint first (z.ai), fallback to China (bigmodel.cn)
  try {
    let res = await fetch("https://api.z.ai/api/paas/v4/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // If international fails with 401 or 404, try China endpoint
    if (res.status === 401 || res.status === 404) {
      res = await fetch("https://open.bigmodel.cn/api/paas/v4/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateMinimax(apiKey: string): Promise<ValidationResult> {
  // MiniMax uses /v1/text/chatcompletion_v2 endpoint (no /models endpoint)
  try {
    const res = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-M2",
        max_completion_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    // 200 or 429 (rate limit) means key is valid
    if (res.ok || res.status === 429) {
      return { valid: true };
    }

    return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function validateYi(apiKey: string): Promise<ValidationResult> {
  // Try international endpoint first (01.ai), fallback to China (lingyiwanwu.com)
  try {
    let res = await fetch("https://api.01.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // If international fails with 401, try China endpoint
    if (res.status === 401) {
      res = await fetch("https://api.lingyiwanwu.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as { data: { id: string }[] };
    const models = data.data?.map(m => m.id) ?? [];
    return { valid: true, models };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

async function testModelWithMinimalRequest(
  provider: ProviderName,
  apiKey: string,
  modelId: string,
): Promise<{ exists: boolean; error?: string }> {
  const baseUrl = getProviderBaseUrl(provider);
  const authHeader = getProviderAuthHeader(provider, apiKey);

  if (!baseUrl || !authHeader) {
    return { exists: false, error: `Unsupported provider: ${provider}` };
  }

  // Try OpenAI-compatible chat completions endpoint
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        [authHeader.name]: authHeader.value,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });

    if (res.status === 404 || (res.status === 400 && (await res.text()).includes("model"))) {
      return { exists: false, error: "Model not found" };
    }
    if (res.ok || res.status === 429) {
      return { exists: true };
    }

    return { exists: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { exists: false, error: String(err) };
  }
}

/**
 * OAuth 2.0 + PKCE implementation for OpenAI Codex authentication.
 */
import * as crypto from "node:crypto";
import * as http from "node:http";
import { URL } from "node:url";
import { OAUTH_CONFIG, type ProviderName } from "@agentgazer/shared";

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random code verifier for PKCE.
 * Must be between 43-128 characters using unreserved URI characters.
 */
export function generateCodeVerifier(): string {
  // 32 bytes = 43 characters in base64url (suitable length)
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate code challenge from verifier using S256 method.
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

// ---------------------------------------------------------------------------
// OAuth token types
// ---------------------------------------------------------------------------

export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  scope?: string;
  /** Account ID extracted from JWT (for Codex API) */
  accountId?: string;
}

/**
 * Decode JWT payload (without verification).
 * WARNING: This does not verify the token signature!
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload);
}

/**
 * Extract account ID from OpenAI JWT access token.
 */
function extractAccountId(accessToken: string): string | undefined {
  try {
    const payload = decodeJwtPayload(accessToken);
    const authData = payload["https://api.openai.com/auth"] as { chatgpt_account_id?: string } | undefined;
    return authData?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

// ---------------------------------------------------------------------------
// OAuth flow: Browser-based with localhost callback
// ---------------------------------------------------------------------------

export interface OAuthFlowOptions {
  provider: ProviderName;
  onAuthUrl?: (url: string) => void;
  onSuccess?: (token: OAuthToken) => void;
  onError?: (error: Error) => void;
}

/**
 * Start OAuth flow with PKCE. Returns the authorization URL and a promise
 * that resolves when the callback is received.
 * NOTE: This browser-based flow is only for openai-oauth. MiniMax uses device code flow.
 */
export async function startOAuthFlow(
  options: OAuthFlowOptions
): Promise<{ authUrl: string; tokenPromise: Promise<OAuthToken> }> {
  if (options.provider !== "openai-oauth") {
    throw new Error(`Browser OAuth flow only supports openai-oauth, not ${options.provider}`);
  }

  const config = OAUTH_CONFIG["openai-oauth"];

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");

  const callbackPath = config.callbackPath ?? "/callback";
  const redirectUri = `http://localhost:${config.callbackPort}${callbackPath}`;

  // Build authorization URL
  const authUrl = new URL(config.authorizeUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // Add extra auth params if configured (for Codex CLI flow)
  if (config.extraAuthParams) {
    for (const [key, value] of Object.entries(config.extraAuthParams)) {
      authUrl.searchParams.set(key, value);
    }
  }

  // Create promise that resolves when callback is received
  const tokenPromise = waitForCallback({
    port: config.callbackPort,
    callbackPath,
    expectedState: state,
    codeVerifier,
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    redirectUri,
  });

  return { authUrl: authUrl.toString(), tokenPromise };
}

interface CallbackOptions {
  port: number;
  callbackPath: string;
  expectedState: string;
  codeVerifier: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
}

/**
 * Start a local HTTP server to wait for the OAuth callback.
 */
function waitForCallback(options: CallbackOptions): Promise<OAuthToken> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${options.port}`);

      if (url.pathname !== options.callbackPath) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const errorDesc = url.searchParams.get("error_description") || error;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authorization Failed</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Authorization Failed</h1>
            <p>${escapeHtml(errorDesc)}</p>
            <p>You can close this window.</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error(`OAuth error: ${errorDesc}`));
        return;
      }

      if (state !== options.expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid State</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Invalid State</h1>
            <p>The authorization response state did not match. Please try again.</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Missing Code</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Missing Authorization Code</h1>
            <p>No authorization code was received. Please try again.</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      // Exchange code for tokens
      try {
        const token = await exchangeCodeForToken({
          code,
          codeVerifier: options.codeVerifier,
          tokenUrl: options.tokenUrl,
          clientId: options.clientId,
          redirectUri: options.redirectUri,
        });

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authorization Successful</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Authorization Successful!</h1>
            <p>You have been logged in to OpenAI Codex.</p>
            <p>You can close this window and return to the terminal.</p>
          </body>
          </html>
        `);
        server.close();
        resolve(token);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Token Exchange Failed</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>Token Exchange Failed</h1>
            <p>${escapeHtml(err instanceof Error ? err.message : String(err))}</p>
          </body>
          </html>
        `);
        server.close();
        reject(err);
      }
    });

    server.on("error", (err) => {
      reject(new Error(`Failed to start callback server: ${err.message}`));
    });

    server.listen(options.port, "127.0.0.1", () => {
      // Server is ready
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timeout (5 minutes)"));
    }, 5 * 60 * 1000);
  });
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

interface TokenExchangeOptions {
  code: string;
  codeVerifier: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
}

async function exchangeCodeForToken(options: TokenExchangeOptions): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    code_verifier: options.codeVerifier,
  });

  const response = await fetch(options.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };

  // Extract account ID from JWT for Codex API
  const accountId = extractAccountId(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    scope: data.scope,
    accountId,
  };
}

// ---------------------------------------------------------------------------
// Device code flow (for headless environments)
// ---------------------------------------------------------------------------

export async function startDeviceCodeFlow(
  provider: ProviderName
): Promise<DeviceCodeResponse> {
  if (provider !== "openai-oauth") {
    throw new Error(`OpenAI device code flow only supports openai-oauth, not ${provider}`);
  }

  const config = OAUTH_CONFIG["openai-oauth"];

  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(" "),
  });

  const response = await fetch(config.deviceCodeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Device code request failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

/**
 * Poll for device code authorization completion.
 */
export async function pollDeviceCodeAuthorization(
  provider: ProviderName,
  deviceCode: string,
  interval: number = 5
): Promise<OAuthToken> {
  if (provider !== "openai-oauth") {
    throw new Error(`OpenAI device code flow only supports openai-oauth, not ${provider}`);
  }

  const config = OAUTH_CONFIG["openai-oauth"];

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: config.clientId,
  });

  while (true) {
    await sleep(interval * 1000);

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (response.ok) {
      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope?: string;
      };

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        scope: data.scope,
      };
    }

    const errorData = await response.json() as { error: string; error_description?: string };

    if (errorData.error === "authorization_pending") {
      // User hasn't authorized yet, continue polling
      continue;
    }

    if (errorData.error === "slow_down") {
      // Increase interval
      interval += 5;
      continue;
    }

    if (errorData.error === "expired_token") {
      throw new Error("Device code expired. Please try again.");
    }

    if (errorData.error === "access_denied") {
      throw new Error("Authorization was denied by the user.");
    }

    throw new Error(`Device authorization failed: ${errorData.error_description || errorData.error}`);
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export async function refreshOAuthToken(
  provider: ProviderName,
  refreshToken: string
): Promise<OAuthToken> {
  if (provider !== "openai-oauth") {
    throw new Error(`OpenAI token refresh only supports openai-oauth, not ${provider}. Use refreshMiniMaxToken for minimax-oauth.`);
  }

  const config = OAUTH_CONFIG["openai-oauth"];

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    scope: data.scope,
  };
}

/**
 * Check if token needs refresh (expires within threshold).
 */
export function tokenNeedsRefresh(token: OAuthToken, thresholdSeconds: number = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  return token.expiresAt - now < thresholdSeconds;
}

// ---------------------------------------------------------------------------
// MiniMax OAuth (User Code Flow)
// ---------------------------------------------------------------------------

export interface MiniMaxAuthorizationResponse {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
  state: string;
}

/**
 * Start MiniMax OAuth flow using user_code grant type.
 * Returns authorization info for user to complete in browser.
 */
export async function startMiniMaxOAuthFlow(
  region: "global" | "cn" = "global"
): Promise<{ auth: MiniMaxAuthorizationResponse; verifier: string }> {
  const config = OAUTH_CONFIG["minimax-oauth"];
  if (!config) {
    throw new Error("No OAuth config for minimax-oauth");
  }

  const codeEndpoint = region === "cn" ? config.codeEndpointCN : config.codeEndpoint;
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = crypto.randomBytes(16).toString("base64url");

  const body = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const response = await fetch(codeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "x-request-id": crypto.randomUUID(),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiniMax OAuth authorization failed: ${text || response.statusText}`);
  }

  const data = await response.json() as {
    user_code: string;
    verification_uri: string;
    expired_in: number;
    interval?: number;
    state: string;
    error?: string;
  };

  if (!data.user_code || !data.verification_uri) {
    throw new Error(data.error ?? "MiniMax OAuth returned incomplete response");
  }

  if (data.state !== state) {
    throw new Error("MiniMax OAuth state mismatch");
  }

  return {
    auth: {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresAt: data.expired_in,
      interval: data.interval ?? 2,
      state,
    },
    verifier,
  };
}

/**
 * Poll MiniMax OAuth token endpoint until user authorizes.
 */
export async function pollMiniMaxAuthorization(
  userCode: string,
  verifier: string,
  interval: number = 2,
  expiresAt: number,
  region: "global" | "cn" = "global"
): Promise<OAuthToken> {
  const config = OAUTH_CONFIG["minimax-oauth"];
  if (!config) {
    throw new Error("No OAuth config for minimax-oauth");
  }

  const tokenEndpoint = region === "cn" ? config.tokenEndpointCN : config.tokenEndpoint;
  let pollInterval = interval * 1000;

  while (Date.now() < expiresAt) {
    await sleep(pollInterval);

    const body = new URLSearchParams({
      grant_type: config.grantType,
      client_id: config.clientId,
      user_code: userCode,
      code_verifier: verifier,
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const text = await response.text();
    let data: {
      status?: string;
      access_token?: string;
      refresh_token?: string;
      expired_in?: number;
      base_resp?: { status_code?: number; status_msg?: string };
    } | undefined;

    try {
      data = JSON.parse(text);
    } catch {
      // Invalid JSON
    }

    if (!response.ok) {
      const errorMsg = data?.base_resp?.status_msg || text || "Unknown error";
      throw new Error(`MiniMax OAuth failed: ${errorMsg}`);
    }

    if (!data) {
      throw new Error("MiniMax OAuth failed to parse response");
    }

    if (data.status === "error") {
      throw new Error("MiniMax OAuth error. Please try again.");
    }

    if (data.status !== "success") {
      // Still pending, increase interval slightly
      pollInterval = Math.min(pollInterval * 1.5, 10000);
      continue;
    }

    if (!data.access_token || !data.refresh_token || !data.expired_in) {
      throw new Error("MiniMax OAuth returned incomplete token");
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expired_in,
    };
  }

  throw new Error("MiniMax OAuth timed out waiting for authorization");
}

/**
 * Refresh MiniMax OAuth token.
 */
export async function refreshMiniMaxToken(
  refreshToken: string,
  region: "global" | "cn" = "global"
): Promise<OAuthToken> {
  const config = OAUTH_CONFIG["minimax-oauth"];
  if (!config) {
    throw new Error("No OAuth config for minimax-oauth");
  }

  const tokenEndpoint = region === "cn" ? config.tokenEndpointCN : config.tokenEndpoint;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiniMax token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expired_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expired_in,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

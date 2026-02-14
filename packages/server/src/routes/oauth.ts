import { Router, Request, Response } from "express";
import * as crypto from "node:crypto";
import * as http from "node:http";
import { URL } from "node:url";
import { isOAuthProvider, OAUTH_CONFIG, type ProviderName } from "@agentgazer/shared";

interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void | boolean>;
  list(service: string): Promise<string[]>;
}

interface OAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  accountId?: string;
}

/**
 * Decode JWT payload (without verification).
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

interface OAuthRouterOptions {
  secretStore: SecretStore;
}

const OAUTH_SERVICE = "com.agentgazer.oauth";

// Track pending OAuth flows (sessionId -> { codeVerifier, state, server })
interface PendingOAuthFlow {
  codeVerifier: string;
  state: string;
  server: http.Server | null;
  provider: ProviderName;
  createdAt: number;
}
const pendingFlows = new Map<string, PendingOAuthFlow>();

// Clean up old pending flows (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, flow] of pendingFlows.entries()) {
    if (now - flow.createdAt > 10 * 60 * 1000) {
      if (flow.server) {
        flow.server.close();
      }
      pendingFlows.delete(sessionId);
    }
  }
}, 60_000);

function isLoopback(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function requireLoopback(req: Request, res: Response, next: () => void): void {
  if (!isLoopback(req)) {
    res.status(403).json({
      error: "OAuth operations are only available from localhost for security",
    });
    return;
  }
  next();
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

// MiniMax device code flow state
interface MiniMaxPendingFlow {
  codeVerifier: string;
  state: string;
  userCode: string;
  expiresAt: number;
  interval: number;
  createdAt: number;
}
const minimaxPendingFlows = new Map<string, MiniMaxPendingFlow>();

// Clean up old MiniMax flows
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, flow] of minimaxPendingFlows.entries()) {
    if (now > flow.expiresAt) {
      minimaxPendingFlows.delete(sessionId);
    }
  }
}, 60_000);

/**
 * Handle MiniMax OAuth start - uses device code flow.
 */
async function handleMiniMaxOAuthStart(
  req: Request,
  res: Response,
  secretStore: SecretStore
): Promise<void> {
  const config = OAUTH_CONFIG["minimax-oauth"];
  const region = (req.body?.region as string) === "cn" ? "cn" : "global";
  const codeEndpoint = region === "cn" ? config.codeEndpointCN : config.codeEndpoint;

  const sessionId = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("base64url");

  const body = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  try {
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
      res.status(response.status).json({ error: `MiniMax OAuth failed: ${text || response.statusText}` });
      return;
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
      res.status(400).json({ error: data.error ?? "MiniMax OAuth returned incomplete response" });
      return;
    }

    if (data.state !== state) {
      res.status(400).json({ error: "MiniMax OAuth state mismatch" });
      return;
    }

    // Store pending flow for polling
    // MiniMax may return interval in milliseconds, cap to reasonable range (1-30 seconds)
    let pollInterval = data.interval ?? 5;
    if (pollInterval > 100) {
      // Likely in milliseconds, convert to seconds
      pollInterval = Math.ceil(pollInterval / 1000);
    }
    pollInterval = Math.max(1, Math.min(pollInterval, 30)); // Clamp to 1-30 seconds

    minimaxPendingFlows.set(sessionId, {
      codeVerifier,
      state,
      userCode: data.user_code,
      expiresAt: Date.now() + (data.expired_in ?? 600) * 1000,
      interval: pollInterval,
      createdAt: Date.now(),
    });

    // Start polling for authorization completion
    startMiniMaxPolling(sessionId, region, secretStore);

    res.json({
      sessionId,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

/**
 * Poll MiniMax token endpoint for authorization completion.
 */
async function startMiniMaxPolling(
  sessionId: string,
  region: "global" | "cn",
  secretStore: SecretStore
): Promise<void> {
  const config = OAUTH_CONFIG["minimax-oauth"];
  const tokenEndpoint = region === "cn" ? config.tokenEndpointCN : config.tokenEndpoint;

  const poll = async (): Promise<void> => {
    const flow = minimaxPendingFlows.get(sessionId);
    if (!flow) return;

    if (Date.now() > flow.expiresAt) {
      minimaxPendingFlows.delete(sessionId);
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: config.grantType,
        client_id: config.clientId,
        user_code: flow.userCode,
        code_verifier: flow.codeVerifier,
      });

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      const responseText = await response.text();

      if (response.ok) {
        const data = JSON.parse(responseText) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
        };

        const oauthToken: OAuthTokenData = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? "",
          expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
          scope: data.scope,
        };

        await secretStore.set(OAUTH_SERVICE, "minimax-oauth", JSON.stringify(oauthToken));
        minimaxPendingFlows.delete(sessionId);
        return;
      }

      // Check for pending state
      let errorData: { error?: string } = {};
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = {};
      }

      if (errorData.error === "authorization_pending" || errorData.error === "slow_down") {
        // Continue polling
        setTimeout(poll, (flow.interval || 5) * 1000);
        return;
      }

      // Other error - stop polling
      minimaxPendingFlows.delete(sessionId);
    } catch {
      // Network error - retry
      setTimeout(poll, (flow?.interval || 5) * 1000);
    }
  };

  // Start first poll after interval
  const flow = minimaxPendingFlows.get(sessionId);
  setTimeout(poll, (flow?.interval || 5) * 1000);
}

export function createOAuthRouter(options: OAuthRouterOptions): Router {
  const { secretStore } = options;
  const router = Router();

  // All OAuth routes require localhost access
  router.use(requireLoopback);

  // GET /api/oauth/:provider/status - Check if logged in
  router.get("/:provider/status", async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as ProviderName;

      if (!isOAuthProvider(provider)) {
        res.status(400).json({ error: `${provider} does not support OAuth` });
        return;
      }

      const tokenJson = await secretStore.get(OAUTH_SERVICE, provider);
      if (!tokenJson) {
        res.json({ loggedIn: false });
        return;
      }

      try {
        const token = JSON.parse(tokenJson) as OAuthTokenData;
        const isExpired = token.expiresAt < Date.now() / 1000;
        res.json({
          loggedIn: !isExpired,
          expiresAt: token.expiresAt,
          expired: isExpired,
        });
      } catch {
        res.json({ loggedIn: false, error: "Invalid token data" });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/oauth/:provider/start - Start OAuth flow
  router.post("/:provider/start", async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as ProviderName;

      if (!isOAuthProvider(provider)) {
        res.status(400).json({ error: `${provider} does not support OAuth` });
        return;
      }

      // Handle different OAuth flows based on provider
      if (provider === "minimax-oauth") {
        // MiniMax uses device code flow
        await handleMiniMaxOAuthStart(req, res, secretStore);
        return;
      }

      // OpenAI browser-based OAuth flow
      if (provider !== "openai-oauth") {
        res.status(400).json({ error: `Unknown OAuth provider: ${provider}` });
        return;
      }

      const config = OAUTH_CONFIG["openai-oauth"];

      const sessionId = crypto.randomBytes(16).toString("hex");
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

      // Store pending flow
      pendingFlows.set(sessionId, {
        codeVerifier,
        state,
        server: null,
        provider,
        createdAt: Date.now(),
      });

      // Start callback server
      const callbackServer = http.createServer(async (cbReq, cbRes) => {
        const url = new URL(cbReq.url || "/", `http://localhost:${config.callbackPort}`);

        if (url.pathname !== callbackPath) {
          cbRes.writeHead(404);
          cbRes.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const flow = pendingFlows.get(sessionId);
        if (!flow) {
          cbRes.writeHead(400, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Session Expired</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Session Expired</h1>
              <p>Please try again.</p>
            </body>
            </html>
          `);
          return;
        }

        if (error) {
          cbRes.writeHead(200, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Authorization Failed</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Authorization Failed</h1>
              <p>${escapeHtml(url.searchParams.get("error_description") || error)}</p>
              <p>You can close this window.</p>
            </body>
            </html>
          `);
          pendingFlows.delete(sessionId);
          callbackServer.close();
          return;
        }

        if (returnedState !== flow.state) {
          cbRes.writeHead(400, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Invalid State</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Invalid State</h1>
              <p>Security check failed. Please try again.</p>
            </body>
            </html>
          `);
          pendingFlows.delete(sessionId);
          callbackServer.close();
          return;
        }

        if (!code) {
          cbRes.writeHead(400, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Missing Code</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Missing Authorization Code</h1>
              <p>Please try again.</p>
            </body>
            </html>
          `);
          pendingFlows.delete(sessionId);
          callbackServer.close();
          return;
        }

        // Exchange code for tokens
        try {
          const tokenBody = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: config.clientId,
            code_verifier: flow.codeVerifier,
          });

          const tokenResponse = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenBody.toString(),
          });

          if (!tokenResponse.ok) {
            const text = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${tokenResponse.status} ${text}`);
          }

          const tokenData = await tokenResponse.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope?: string;
          };

          const oauthToken: OAuthTokenData = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
            scope: tokenData.scope,
            accountId: extractAccountId(tokenData.access_token),
          };

          // Store token
          await secretStore.set(OAUTH_SERVICE, provider, JSON.stringify(oauthToken));

          cbRes.writeHead(200, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Authorization Successful</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Authorization Successful!</h1>
              <p>You have been logged in to OpenAI Codex.</p>
              <p>You can close this window and return to AgentGazer.</p>
            </body>
            </html>
          `);
        } catch (err) {
          cbRes.writeHead(500, { "Content-Type": "text/html" });
          cbRes.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Token Exchange Failed</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Token Exchange Failed</h1>
              <p>${escapeHtml(err instanceof Error ? err.message : String(err))}</p>
            </body>
            </html>
          `);
        }

        pendingFlows.delete(sessionId);
        callbackServer.close();
      });

      callbackServer.listen(config.callbackPort, "127.0.0.1", () => {
        const flow = pendingFlows.get(sessionId);
        if (flow) {
          flow.server = callbackServer;
        }
      });

      // Set timeout to close server after 5 minutes
      setTimeout(() => {
        if (pendingFlows.has(sessionId)) {
          callbackServer.close();
          pendingFlows.delete(sessionId);
        }
      }, 5 * 60 * 1000);

      res.json({
        sessionId,
        authUrl: authUrl.toString(),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/oauth/:provider/logout - Remove OAuth tokens
  router.post("/:provider/logout", async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as ProviderName;

      if (!isOAuthProvider(provider)) {
        res.status(400).json({ error: `${provider} does not support OAuth` });
        return;
      }

      await secretStore.delete(OAUTH_SERVICE, provider);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

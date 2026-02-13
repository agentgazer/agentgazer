## Context

AgentGazer currently supports API key authentication for all providers. OpenAI offers Codex subscription ($200/month) which provides unlimited API access through OAuth authentication. Users with Codex subscriptions want to use AgentGazer without per-token billing.

**Current state:**
- All providers use API key stored in secret-store
- Cost calculation assumes per-token billing
- OpenClaw integration generates config based on configured providers

**Constraints:**
- Must not break existing API key authentication
- OAuth tokens expire and need automatic refresh
- Dashboard OAuth flow requires localhost callback server

## Goals / Non-Goals

**Goals:**
- Add `openai-oauth` as a separate provider from `openai`
- Support OAuth 2.0 + PKCE flow via CLI and Dashboard
- Track requests with cost = $0 for subscription billing
- Auto-refresh tokens before expiry
- Integrate seamlessly with OpenClaw template

**Non-Goals:**
- Other provider OAuth (anthropic-oauth, etc.) — future work
- Cloud/hosted OAuth (requires registered redirect URI)
- Replacing API key auth — both methods coexist

## Decisions

### Decision 1: Separate provider `openai-oauth`

**Choice:** Create `openai-oauth` as a distinct provider rather than adding OAuth option to existing `openai` provider.

**Rationale:**
- Cleaner separation of concerns (different auth, different billing)
- Users can have both configured simultaneously
- Simpler cost calculation logic (provider-level, not per-request)
- Consistent with how OpenClaw shows providers in template

**Alternatives considered:**
- Add OAuth flag to existing `openai` provider — rejected due to complexity in determining which auth to use per-request

### Decision 2: PKCE OAuth flow with localhost callback

**Choice:** Use OAuth 2.0 Authorization Code flow with PKCE, callback to `localhost:9119`.

**Rationale:**
- Matches Codex CLI's implementation (proven to work)
- PKCE provides security without requiring client secret
- Localhost callback works for local-first architecture

**OAuth endpoints:**
- Authorization: `https://auth.openai.com/authorize`
- Token: `https://auth.openai.com/oauth/token`
- Device code: `https://auth.openai.com/codex/device`
- Client ID: `app_EMoamEEZ73f0CkXaXp7hrann`

### Decision 3: Token storage in secret-store

**Choice:** Store OAuth tokens using existing secret-store infrastructure.

**Format:**
```json
{
  "provider": "openai-oauth",
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1707123456
}
```

**Rationale:**
- Reuses existing secure storage (Keychain/libsecret/encrypted file)
- Consistent with API key storage pattern
- Proxy can read tokens same way as API keys

### Decision 4: Request-time token refresh

**Choice:** Check token expiry before each request, refresh if < 5 minutes remaining.

**Rationale:**
- Simpler than background refresh daemon
- Adds minimal latency (only when refresh needed)
- No additional background processes

**Alternative considered:**
- Background interval refresh — rejected due to complexity and resource usage

### Decision 5: Cost = $0 for subscription providers

**Choice:** `calculateCost()` returns 0 for providers with `billing: "subscription"`.

**Rationale:**
- Simple and accurate — subscription users pay fixed monthly fee
- Dashboard can still show token counts for usage tracking
- Clear distinction in cost analysis views

### Decision 6: Dashboard OAuth via Server API

**Choice:** Dashboard initiates OAuth through Server API, not direct browser flow.

**Flow:**
1. Dashboard calls `POST /api/oauth/openai/start`
2. Server starts callback server, returns auth URL
3. Dashboard opens auth URL in new window
4. User authorizes, OpenAI redirects to localhost:9119
5. Server exchanges code for tokens, stores in secret-store
6. Dashboard polls `GET /api/oauth/openai/status` for completion

**Rationale:**
- Server manages callback server lifecycle
- Tokens stored server-side (CLI and Dashboard share)
- Consistent state across CLI and Dashboard

## Risks / Trade-offs

**[Risk] OAuth token expires during long operation**
→ Mitigation: Check expiry before each request, refresh proactively with 5-min buffer

**[Risk] Callback port 9119 already in use**
→ Mitigation: Check port availability, show clear error message with instructions

**[Risk] OpenAI changes OAuth endpoints or client_id**
→ Mitigation: Centralize OAuth config in shared package for easy updates

**[Risk] User confusion between openai and openai-oauth**
→ Mitigation: Clear labeling in Dashboard ("OpenAI (API Key)" vs "OpenAI (Codex OAuth)")

**[Trade-off] Separate providers means two entries in provider list**
→ Acceptable: Users understand the distinction, can use whichever fits their billing

## Open Questions

1. **Codex model availability** — Are all models available via OAuth, or only Codex-specific models (gpt-5.x-codex)?
   - Initial assumption: Support Codex models only, can expand later

2. **Token refresh endpoint** — Does OpenAI use standard OAuth refresh_token grant?
   - Need to verify during implementation

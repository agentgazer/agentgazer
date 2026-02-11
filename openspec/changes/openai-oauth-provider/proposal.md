## Why

OpenAI Codex subscription users pay a monthly fee ($200/month) for unlimited API access. Currently, AgentGazer only supports API key authentication which is billed per-token. Adding OAuth support allows Codex subscribers to use their subscription through AgentGazer with $0 cost tracking, providing a cost-effective option for high-volume users.

## What Changes

- Add `openai-oauth` as a new provider (separate from `openai` which uses API keys)
- Implement OAuth 2.0 + PKCE flow for OpenAI authentication
- Add CLI commands: `agentgazer login openai-oauth`, `agentgazer logout openai-oauth`
- Add Dashboard OAuth login button in OpenClaw integration page
- OAuth provider requests are tracked with cost = $0 (subscription billing)
- OpenClaw template automatically includes `openai-oauth-traced` when logged in

## Capabilities

### New Capabilities
- `oauth-provider`: OAuth 2.0 authentication flow for LLM providers, starting with OpenAI. Includes PKCE flow, device code flow, token storage, and automatic token refresh.

### Modified Capabilities
- `openclaw-integration`: Add "Login OpenAI Codex" button alongside "Add Provider". Template includes `openai-oauth-traced` when OAuth is configured.

## Impact

- **packages/shared**: Add `openai-oauth` provider config, mark as subscription billing
- **packages/shared/pricing.ts**: Return cost=0 for subscription providers
- **packages/cli**: Add `login`/`logout` commands, OAuth flow implementation
- **packages/cli/secret-store**: Store OAuth tokens (access + refresh)
- **packages/proxy**: Inject OAuth token, auto-refresh before expiry
- **packages/server**: OAuth API endpoints for dashboard-initiated login
- **apps/dashboard-local**: OpenClaw page OAuth button, provider status display

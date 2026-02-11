## 1. Provider Definition

- [x] 1.1 Add `openai-oauth` to PROVIDER_CONFIG in packages/shared/src/providers.ts
- [x] 1.2 Add Codex models to PROVIDER_MODELS in packages/shared/src/models.ts
- [x] 1.3 Import `isSubscriptionProvider()` from providers.ts and use in pricing.ts
- [x] 1.4 Ensure `calculateCost()` returns 0 for subscription providers

## 2. OAuth Module

- [x] 2.1 Create packages/cli/src/oauth.ts with OAuth flow implementation
- [x] 2.2 Implement PKCE code verifier/challenge generation
- [x] 2.3 Implement localhost callback server (port 9119)
- [x] 2.4 Implement token exchange (authorization code → access/refresh tokens)
- [x] 2.5 Implement device code flow as alternative

## 3. Token Storage

- [x] 3.1 Add OAuth token type to secret-store interface
- [x] 3.2 Implement storeOAuthToken() in packages/cli/src/secret-store.ts
- [x] 3.3 Implement getOAuthToken() in packages/cli/src/secret-store.ts
- [x] 3.4 Implement removeOAuthToken() in packages/cli/src/secret-store.ts

## 4. CLI Commands

- [x] 4.1 Add `login` command to packages/cli/src/cli.ts
- [x] 4.2 Add `logout` command to packages/cli/src/cli.ts
- [x] 4.3 Implement `agentgazer login openai-oauth` (browser flow)
- [x] 4.4 Implement `agentgazer login openai-oauth --device` (device code flow)
- [x] 4.5 Implement `agentgazer logout openai-oauth`
- [x] 4.6 Show openai-oauth in `agentgazer providers` list when logged in

## 5. Token Refresh

- [x] 5.1 Implement refreshOAuthToken() in oauth.ts
- [x] 5.2 Add token expiry check before requests in proxy
- [x] 5.3 Auto-refresh token if expiring within 5 minutes

## 6. Proxy Integration

- [x] 6.1 Add openai-oauth to proxy routing logic
- [x] 6.2 Inject OAuth token from secret-store for openai-oauth requests
- [x] 6.3 Handle 401 response when OAuth not configured
- [x] 6.4 Update cost calculation to use effective provider billing type

## 7. Server OAuth API

- [x] 7.1 Create packages/server/src/routes/oauth.ts
- [x] 7.2 Implement POST /api/oauth/openai/start endpoint
- [x] 7.3 Implement GET /api/oauth/openai/status endpoint
- [x] 7.4 Implement POST /api/oauth/openai/logout endpoint
- [x] 7.5 Add localhost-only middleware to OAuth routes
- [x] 7.6 Register OAuth router in server.ts

## 8. Dashboard OpenClaw Page

- [x] 8.1 Add "Login OpenAI Codex" button to OpenClawPage.tsx
- [x] 8.2 Implement OAuth flow initiation from button click
- [x] 8.3 Add polling for OAuth completion status
- [x] 8.4 Show login success/failure feedback
- [x] 8.5 Add logout button when already logged in

## 9. Dashboard Template Updates

- [x] 9.1 Add openai-oauth to PROVIDER_MODELS in OpenClawPage.tsx
- [x] 9.2 Add openai-oauth to PROVIDER_API_MAP
- [x] 9.3 Include openai-oauth-traced in generated config when configured
- [x] 9.4 Show auth type badge (API Key / OAuth) for each provider

## 10. Testing

- [ ] 10.1 Test CLI login flow with browser
- [ ] 10.2 Test CLI login flow with device code
- [ ] 10.3 Test token refresh mechanism
- [ ] 10.4 Test proxy routing with OAuth token
- [ ] 10.5 Test Dashboard OAuth flow
- [ ] 10.6 Test OpenClaw template generation with OAuth

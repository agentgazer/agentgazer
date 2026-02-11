## ADDED Requirements

### Requirement: openai-oauth provider definition
The system SHALL define `openai-oauth` as a provider with OAuth authentication and subscription billing.

#### Scenario: Provider configuration
- **WHEN** the provider `openai-oauth` is defined
- **THEN** it SHALL have:
  - `authType`: "oauth"
  - `billing`: "subscription"
  - `baseUrl`: "https://api.openai.com"
  - `chatEndpoint`: "/v1/chat/completions"
  - OAuth config with authorization, token, and device code URLs

### Requirement: CLI login command
The system SHALL provide `agentgazer login openai-oauth` command to initiate OAuth authentication.

#### Scenario: Browser OAuth flow
- **WHEN** user runs `agentgazer login openai-oauth`
- **THEN** the CLI opens the browser to OpenAI authorization page
- **AND** starts a localhost callback server on port 9119
- **AND** waits for the OAuth callback

#### Scenario: Device code flow
- **WHEN** user runs `agentgazer login openai-oauth --device`
- **THEN** the CLI displays a device code and URL
- **AND** user can authorize from any browser
- **AND** CLI polls until authorization completes

#### Scenario: Successful login
- **WHEN** OAuth authorization completes successfully
- **THEN** access_token and refresh_token are stored in secret-store
- **AND** CLI displays "Login successful"
- **AND** `openai-oauth` appears in provider list

### Requirement: CLI logout command
The system SHALL provide `agentgazer logout openai-oauth` command to remove OAuth credentials.

#### Scenario: Logout when logged in
- **WHEN** user runs `agentgazer logout openai-oauth`
- **AND** OAuth tokens exist in secret-store
- **THEN** tokens are removed from secret-store
- **AND** CLI displays "Logged out successfully"

#### Scenario: Logout when not logged in
- **WHEN** user runs `agentgazer logout openai-oauth`
- **AND** no OAuth tokens exist
- **THEN** CLI displays "Not logged in"

### Requirement: OAuth token storage
The system SHALL store OAuth tokens securely using the existing secret-store infrastructure.

#### Scenario: Token format
- **WHEN** OAuth tokens are stored
- **THEN** the stored data includes:
  - `access_token`: the OAuth access token
  - `refresh_token`: the OAuth refresh token
  - `expires_at`: Unix timestamp of access token expiry

#### Scenario: Token retrieval
- **WHEN** proxy needs to authenticate a request
- **THEN** it retrieves OAuth token from secret-store using provider name "openai-oauth"

### Requirement: Automatic token refresh
The system SHALL automatically refresh OAuth tokens before they expire.

#### Scenario: Token near expiry
- **WHEN** a request is made to openai-oauth provider
- **AND** access_token expires in less than 5 minutes
- **THEN** the system refreshes the token using refresh_token
- **AND** stores the new tokens in secret-store
- **AND** uses the new access_token for the request

#### Scenario: Refresh token expired
- **WHEN** token refresh fails due to expired refresh_token
- **THEN** the system returns an error indicating re-login is required
- **AND** logs a warning message

### Requirement: Proxy OAuth token injection
The proxy SHALL inject OAuth tokens for openai-oauth provider requests.

#### Scenario: Request to openai-oauth provider
- **WHEN** a request is routed to openai-oauth provider
- **AND** OAuth tokens are configured
- **THEN** the proxy sets `Authorization: Bearer {access_token}` header
- **AND** forwards the request to api.openai.com

#### Scenario: No OAuth token configured
- **WHEN** a request is routed to openai-oauth provider
- **AND** no OAuth tokens are configured
- **THEN** the proxy returns HTTP 401 with error "OAuth not configured. Run 'agentgazer login openai-oauth'"

### Requirement: Subscription billing cost calculation
The system SHALL return cost = 0 for providers with subscription billing.

#### Scenario: Cost calculation for openai-oauth
- **WHEN** calculating cost for a request to openai-oauth provider
- **THEN** the calculated cost is 0 regardless of token count

#### Scenario: Dashboard cost display
- **WHEN** displaying costs for openai-oauth provider in dashboard
- **THEN** cost shows as "$0.00" or "Subscription"
- **AND** token counts are still displayed

### Requirement: Server OAuth API endpoints
The server SHALL provide API endpoints for dashboard-initiated OAuth flow.

#### Scenario: Start OAuth flow
- **WHEN** `POST /api/oauth/openai/start` is called
- **THEN** server starts callback server on port 9119
- **AND** returns `{ authUrl: "https://auth.openai.com/authorize?..." }`

#### Scenario: Check OAuth status
- **WHEN** `GET /api/oauth/openai/status` is called
- **THEN** returns `{ loggedIn: true/false, expiresAt?: number }`

#### Scenario: Logout via API
- **WHEN** `POST /api/oauth/openai/logout` is called
- **THEN** removes OAuth tokens from secret-store
- **AND** returns `{ success: true }`

#### Scenario: OAuth API localhost only
- **WHEN** OAuth API endpoints are called from non-loopback IP
- **THEN** server returns HTTP 403 Forbidden

### Requirement: openai-oauth model list
The system SHALL provide the list of models available for openai-oauth provider.

#### Scenario: Codex subscription models
- **WHEN** listing models for openai-oauth provider
- **THEN** the list includes Codex subscription models:
  - gpt-5.3-codex
  - gpt-5.2-codex
  - gpt-5.1-codex-mini
  - gpt-5.1-codex-max
  - gpt-5.1-codex
  - gpt-5-codex

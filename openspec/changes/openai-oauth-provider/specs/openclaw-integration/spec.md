## ADDED Requirements

### Requirement: Dashboard shows OAuth login button
The OpenClaw integration page SHALL display a "Login OpenAI Codex" button alongside the "Add Provider" button.

#### Scenario: OAuth button displayed
- **WHEN** user navigates to OpenClaw integration page
- **THEN** the Prerequisites section shows two buttons:
  - "Add Provider" (for API key providers)
  - "Login OpenAI Codex" (for OAuth)

#### Scenario: OAuth button when not logged in
- **WHEN** openai-oauth is not configured
- **THEN** the "Login OpenAI Codex" button is enabled
- **AND** clicking it initiates the OAuth flow

#### Scenario: OAuth button when logged in
- **WHEN** openai-oauth is already configured
- **THEN** the button shows "OpenAI Codex: Logged in ✓"
- **AND** a "Logout" option is available

### Requirement: Dashboard initiates OAuth from button
The dashboard SHALL initiate OAuth flow when user clicks "Login OpenAI Codex".

#### Scenario: Start OAuth flow
- **WHEN** user clicks "Login OpenAI Codex" button
- **THEN** dashboard calls `POST /api/oauth/openai/start`
- **AND** opens the returned auth URL in a new window
- **AND** shows "Waiting for authorization..." status

#### Scenario: OAuth completes successfully
- **WHEN** OAuth flow completes in the browser
- **THEN** dashboard detects completion via polling `/api/oauth/openai/status`
- **AND** shows "Login successful!" message
- **AND** refreshes the provider list

#### Scenario: OAuth cancelled or failed
- **WHEN** user closes OAuth window without authorizing
- **OR** OAuth flow fails
- **THEN** dashboard shows appropriate error message
- **AND** returns to initial state

### Requirement: Template includes openai-oauth when configured
The generated OpenClaw configuration SHALL include `openai-oauth-traced` provider when openai-oauth is configured.

#### Scenario: Generate config with OAuth
- **WHEN** openai-oauth is configured (logged in)
- **THEN** the generated config includes:
  ```json
  {
    "openai-oauth-traced": {
      "baseUrl": "http://localhost:18900/agents/{agentName}/openai-oauth",
      "apiKey": "managed-by-agentgazer",
      "api": "openai-completions",
      "models": [/* Codex models */]
    }
  }
  ```

#### Scenario: Model dropdown includes OAuth models
- **WHEN** openai-oauth is configured
- **THEN** the default model dropdown includes options like:
  - "openai-oauth-traced/gpt-5.3-codex"
  - "openai-oauth-traced/gpt-5.2-codex"

### Requirement: Provider status shows auth type
The OpenClaw integration page SHALL clearly distinguish between API key and OAuth providers.

#### Scenario: Display provider auth type
- **WHEN** displaying configured providers
- **THEN** each provider shows its auth type:
  - "openai" shows "(API Key)"
  - "openai-oauth" shows "(OAuth ✓)"
  - "anthropic" shows "(API Key)"

#### Scenario: Provider list with both openai types
- **WHEN** both openai and openai-oauth are configured
- **THEN** both appear in the provider list as separate entries
- **AND** both are included in the generated template

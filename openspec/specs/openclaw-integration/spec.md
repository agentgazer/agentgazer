## ADDED Requirements

### Requirement: Server can read OpenClaw config
The server SHALL provide an API endpoint `GET /api/openclaw/config` that reads `~/.openclaw/openclaw.json` and returns the current configuration, focusing on the `models` key.

#### Scenario: Config file exists with models
- **WHEN** the OpenClaw config file exists at `~/.openclaw/openclaw.json` with a `models` key
- **THEN** the API returns `{ exists: true, models: <content of models key> }`

#### Scenario: Config file exists without models key
- **WHEN** the OpenClaw config file exists but has no `models` key
- **THEN** the API returns `{ exists: true, models: null }`

#### Scenario: Config file does not exist
- **WHEN** the OpenClaw config file does not exist
- **THEN** the API returns `{ exists: false, models: null }`

#### Scenario: Config file has invalid JSON
- **WHEN** the OpenClaw config file exists but contains invalid JSON
- **THEN** the API returns `{ exists: true, parseError: true, raw: <raw file contents> }`

### Requirement: Server can write OpenClaw config models
The server SHALL provide an API endpoint `PUT /api/openclaw/config` that updates the `models` key in `~/.openclaw/openclaw.json`, preserving other keys.

#### Scenario: Update models in existing config
- **WHEN** the config file exists with other keys
- **AND** a PUT request is made with new `models` content
- **THEN** the `models` key is updated while preserving all other keys
- **AND** the API returns `{ success: true }`

#### Scenario: Create models key in existing config
- **WHEN** the config file exists without a `models` key
- **AND** a PUT request is made with `models` content
- **THEN** the `models` key is added
- **AND** the API returns `{ success: true }`

#### Scenario: Create config file with models
- **WHEN** the config file does not exist
- **AND** a PUT request is made with `models` content
- **THEN** the file is created with the `models` key
- **AND** the `~/.openclaw` directory is created if needed
- **AND** the API returns `{ success: true }`

### Requirement: OpenClaw config API is localhost-only
The OpenClaw config API SHALL only be accessible from localhost (loopback interface) for security.

#### Scenario: Request from localhost
- **WHEN** a request to `/api/openclaw/config` comes from `127.0.0.1` or `::1`
- **THEN** the request is processed normally

#### Scenario: Request from remote host
- **WHEN** a request to `/api/openclaw/config` comes from a non-loopback IP
- **THEN** the API returns HTTP 403 Forbidden

### Requirement: Dashboard provides OpenClaw integration page
The dashboard SHALL provide an "OpenClaw Integration" page accessible from the navigation.

#### Scenario: User navigates to integration page
- **WHEN** user clicks "OpenClaw" in the navigation
- **THEN** the OpenClaw integration page is displayed
- **AND** the current config is loaded automatically

### Requirement: Dashboard can generate provider config
The dashboard SHALL generate the correct OpenClaw provider configuration based on configured AgentGazer providers.

#### Scenario: Generate config for configured providers
- **WHEN** user has providers configured in AgentGazer (e.g., anthropic, openai)
- **THEN** the page shows generated `models.providers` config with:
  - `baseUrl` pointing to `http://localhost:<proxy-port>/<provider>`
  - Correct `api` field (`anthropic-messages` or `openai-completions`)

#### Scenario: No providers configured
- **WHEN** no providers are configured in AgentGazer
- **THEN** the page shows a message to configure providers first

### Requirement: Dashboard can apply config to OpenClaw
The dashboard SHALL allow users to apply the generated configuration with one click.

#### Scenario: Apply config when file exists
- **WHEN** user clicks "Apply Configuration"
- **AND** the OpenClaw config file exists
- **THEN** the `models` key is updated with the generated config
- **AND** success message is displayed

#### Scenario: Apply config when file does not exist
- **WHEN** user clicks "Apply Configuration"
- **AND** the OpenClaw config file does not exist
- **THEN** the file is created with the generated `models` config
- **AND** success message is displayed

### Requirement: Dashboard can set default model
The dashboard SHALL allow users to select primary and secondary default models from configured providers.

#### Scenario: Select primary model
- **WHEN** user selects a model from the primary model dropdown
- **THEN** the dropdown shows models from all configured providers in format `<provider-alias>/<model-id>`

#### Scenario: Select secondary model (optional)
- **WHEN** user selects a model from the secondary model dropdown
- **THEN** the secondary model is set as fallback

#### Scenario: Apply default model via button
- **WHEN** user clicks "Apply" for default model
- **THEN** the `agents.defaults.model.primary` key is written to config file
- **AND** the `agents.defaults.model.secondary` key is written if selected
- **AND** other config keys are preserved

### Requirement: Dashboard shows copy-able CLI command
The dashboard SHALL show the equivalent `openclaw config set` command for users who prefer manual configuration.

#### Scenario: Display command for primary model
- **WHEN** user has selected a primary model
- **THEN** the page displays: `openclaw config set agents.defaults.model.primary "<provider>/<model>"`
- **AND** a copy button is available

#### Scenario: Display command for secondary model
- **WHEN** user has selected a secondary model
- **THEN** the page also displays the secondary model command

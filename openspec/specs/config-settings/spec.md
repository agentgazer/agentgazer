## ADDED Requirements

### Requirement: Hierarchical config structure

Config SHALL use a hierarchical structure with `server`, `data`, and `alerts` sections.

#### Scenario: New config created
- **WHEN** a new config is created
- **THEN** it uses the hierarchical structure

#### Scenario: Legacy config migration
- **GIVEN** a config with flat structure (port, proxyPort at root level)
- **WHEN** config is read
- **THEN** it is migrated to hierarchical structure
- **AND** the migrated config is written back to file

### Requirement: Settings API

Server SHALL provide GET/PUT /api/settings endpoints.

#### Scenario: Get settings
- **WHEN** client calls GET /api/settings
- **THEN** server returns config without token and providers

#### Scenario: Update settings
- **WHEN** client calls PUT /api/settings with partial config
- **THEN** server merges the changes into existing config
- **AND** writes the updated config to file
- **AND** returns the complete updated settings

### Requirement: Dashboard settings page

Dashboard SHALL provide a Settings page at /settings route.

#### Scenario: View settings
- **WHEN** user navigates to /settings
- **THEN** Dashboard displays current settings in form fields

#### Scenario: Edit settings
- **WHEN** user modifies settings and clicks Save
- **THEN** Dashboard calls PUT /api/settings
- **AND** displays success message

#### Scenario: Port change warning
- **WHEN** user changes port or proxyPort and saves
- **THEN** Dashboard displays "Restart required for port changes to take effect"

### Requirement: Alert defaults

Config SHALL support alert notification defaults under `alerts.defaults`.

#### Scenario: Store telegram defaults
- **WHEN** user saves telegram settings in Dashboard
- **THEN** botToken and chatId are stored in alerts.defaults.telegram

#### Scenario: Store webhook defaults
- **WHEN** user saves webhook URL in Dashboard
- **THEN** URL is stored in alerts.defaults.webhook.url

### Requirement: CLI uses alert defaults

CLI alert add command SHALL use stored defaults.

#### Scenario: Auto-fill telegram
- **GIVEN** alerts.defaults.telegram has botToken and chatId
- **WHEN** user runs `agent <name> alert add <type> --telegram`
- **THEN** CLI uses stored botToken and chatId

#### Scenario: Auto-fill webhook
- **GIVEN** alerts.defaults.webhook.url is set
- **WHEN** user runs `agent <name> alert add <type> --webhook`
- **THEN** CLI uses stored webhook URL

#### Scenario: Explicit values override defaults
- **GIVEN** alerts.defaults.webhook.url is "https://old.com"
- **WHEN** user runs `agent <name> alert add <type> --webhook https://new.com`
- **THEN** CLI uses "https://new.com" instead of default

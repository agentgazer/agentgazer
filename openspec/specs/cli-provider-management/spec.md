## ADDED Requirements

### Requirement: List providers command

The CLI SHALL provide an `agentgazer providers` command that displays all configured providers in a table format, showing provider name, status (active/inactive), key status (secured/not set), and usage stats.

#### Scenario: List providers with data
- **WHEN** user runs `agentgazer providers`
- **THEN** CLI displays a table with columns: Provider, Status, Key, Calls, Cost

#### Scenario: List providers when empty
- **WHEN** user runs `agentgazer providers` and no providers are configured
- **THEN** CLI displays "No providers configured. Use 'agentgazer provider add' to add one."

### Requirement: Provider add command

The CLI SHALL provide an `agentgazer provider add [provider] [key]` command that adds a provider with API key. Arguments are optional for interactive mode.

#### Scenario: Fully interactive add
- **WHEN** user runs `agentgazer provider add`
- **THEN** CLI prompts "Select provider:" with numbered list
- **AND** after selection, prompts "API key for <provider>:"
- **AND** validates key and stores in secret store
- **AND** displays "Provider '<provider>' configured."

#### Scenario: Add with provider name only
- **WHEN** user runs `agentgazer provider add openai`
- **THEN** CLI prompts "API key for openai:"
- **AND** validates key and stores in secret store
- **AND** displays "Provider 'openai' configured."

#### Scenario: Add with both arguments
- **WHEN** user runs `agentgazer provider add openai sk-xxx`
- **THEN** CLI validates key and stores in secret store without prompting
- **AND** displays "Provider 'openai' configured."

#### Scenario: Add with unknown provider
- **WHEN** user runs `agentgazer provider add custom-llm`
- **THEN** CLI warns "Unknown provider 'custom-llm'. Known providers: openai, anthropic, ..."
- **AND** prompts "Continue anyway? [y/N]"

### Requirement: Provider active command

The CLI SHALL provide an `agentgazer provider <name> active` command that enables a provider.

#### Scenario: Activate provider
- **WHEN** user runs `agentgazer provider openai active`
- **THEN** CLI sends PUT to `/api/providers/openai/settings` with `{"active": true}`
- **AND** displays "Provider 'openai' activated."

### Requirement: Provider deactive command

The CLI SHALL provide an `agentgazer provider <name> deactive` command that disables a provider.

#### Scenario: Deactivate provider
- **WHEN** user runs `agentgazer provider openai deactive`
- **THEN** CLI sends PUT to `/api/providers/openai/settings` with `{"active": false}`
- **AND** displays "Provider 'openai' deactivated. All requests to this provider will be blocked."

### Requirement: Provider test-connection command

The CLI SHALL provide an `agentgazer provider <name> test-connection` command that tests the API key validity.

#### Scenario: Test successful connection
- **WHEN** user runs `agentgazer provider openai test-connection`
- **THEN** CLI loads key from secret store
- **AND** validates key against provider API
- **AND** displays "✓ Connection successful for 'openai'."

#### Scenario: Test failed connection
- **WHEN** user runs `agentgazer provider openai test-connection`
- **AND** key is invalid
- **THEN** CLI displays "✗ Connection failed for 'openai': Invalid API key"

#### Scenario: Test with no key configured
- **WHEN** user runs `agentgazer provider openai test-connection`
- **AND** no key is stored
- **THEN** CLI displays "No API key configured for 'openai'. Use 'agentgazer provider add openai' first."

### Requirement: Provider delete command

The CLI SHALL provide an `agentgazer provider <name> delete` command that removes a provider and its API key.

#### Scenario: Delete provider with confirmation
- **WHEN** user runs `agentgazer provider openai delete`
- **THEN** CLI prompts "Delete provider 'openai' and its API key? [y/N]"
- **AND** if confirmed, removes key from secret store and config
- **AND** displays "Provider 'openai' deleted."

#### Scenario: Delete provider with --yes flag
- **WHEN** user runs `agentgazer provider openai delete --yes`
- **THEN** CLI skips confirmation and deletes immediately

### Requirement: Provider models command

The CLI SHALL provide an `agentgazer provider <name> models` command that lists available models for a provider.

#### Scenario: List provider models
- **WHEN** user runs `agentgazer provider openai models`
- **THEN** CLI displays list of models with pricing info from built-in pricing table

#### Scenario: List unknown provider models
- **WHEN** user runs `agentgazer provider custom-llm models`
- **THEN** CLI displays "No built-in models for 'custom-llm'."

### Requirement: Provider stat command

The CLI SHALL provide an `agentgazer provider <name> stat` command that displays usage statistics for a provider.

#### Scenario: Show provider stats
- **WHEN** user runs `agentgazer provider openai stat`
- **THEN** CLI displays statistics including: total calls, total cost, total tokens, top models used, top agents using this provider

#### Scenario: Show provider stats with range
- **WHEN** user runs `agentgazer provider openai stat --range 7d`
- **THEN** CLI displays statistics for the last 7 days

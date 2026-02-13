# onboard-provider-select Specification

## Purpose
TBD - created by archiving change onboard-interactive-provider-select. Update Purpose after archive.
## Requirements
### Requirement: Interactive provider selection

The onboard command SHALL display an interactive multi-select checkbox list of available providers instead of prompting for each provider sequentially.

#### Scenario: User selects multiple providers
- **WHEN** user runs `agentgazer onboard`
- **THEN** system displays a checkbox list of all selectable providers
- **THEN** user can navigate with arrow keys and toggle selection with space
- **THEN** user confirms selection with Enter

#### Scenario: User selects no providers
- **WHEN** user runs `agentgazer onboard` and presses Enter without selecting any providers
- **THEN** system completes onboard with "0 provider(s) configured" message
- **THEN** no API key prompts are shown

### Requirement: OAuth provider labeling

OAuth providers SHALL be displayed with "(OAuth - configure in Dashboard)" suffix and SHALL NOT prompt for API key if selected.

#### Scenario: OAuth provider displayed in list
- **WHEN** provider list is displayed
- **THEN** OAuth providers (e.g., openai-oauth) show label like "OpenAI Codex (OAuth - configure in Dashboard)"

#### Scenario: OAuth provider selected
- **WHEN** user selects an OAuth provider and confirms
- **THEN** system skips API key prompt for that provider
- **THEN** system continues to next selected provider or completes

### Requirement: Configured provider indicator

Providers that already have API keys configured SHALL display "✓ configured" indicator in the selection list.

#### Scenario: Configured provider displayed
- **WHEN** provider list is displayed
- **THEN** providers with existing API keys show indicator like "Anthropic (Claude) ✓ configured"

#### Scenario: Re-configuring existing provider
- **WHEN** user selects a configured provider and enters a new API key
- **THEN** system overwrites the existing API key with the new one
- **THEN** system shows "✓ {provider} configured." confirmation

### Requirement: API key prompts only for selected providers

After selection confirmation, the system SHALL only prompt for API keys for the providers the user selected (excluding OAuth providers).

#### Scenario: Prompt order matches selection
- **WHEN** user selects DeepSeek and Zhipu (in any order)
- **THEN** system prompts for DeepSeek API key
- **THEN** system prompts for Zhipu API key
- **THEN** system shows completion message with "2 provider(s) configured"


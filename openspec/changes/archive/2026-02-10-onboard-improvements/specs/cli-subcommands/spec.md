## MODIFIED Requirements

### Requirement: Provider list display
The onboard command SHALL display provider names with their popular model names for user recognition.

#### Scenario: Provider list shows model names
- **WHEN** onboard displays available providers
- **THEN** each provider shows format "provider (Model)" e.g., "zhipu (GLM-4)", "anthropic (Claude)"

#### Scenario: All supported providers have model names
- **WHEN** displaying provider list
- **THEN** the following mappings are shown:
  - openai (GPT-4)
  - anthropic (Claude)
  - google (Gemini)
  - mistral (Mistral)
  - cohere (Command)
  - deepseek (DeepSeek)
  - moonshot (Kimi)
  - zhipu (GLM-4)
  - minimax (abab)
  - baichuan (Baichuan)

## REMOVED Requirements

### Requirement: Yi provider support
**Reason**: Yi API is discontinued/inaccessible
**Migration**: Users should use alternative providers. No data migration needed as Yi was rarely configured.

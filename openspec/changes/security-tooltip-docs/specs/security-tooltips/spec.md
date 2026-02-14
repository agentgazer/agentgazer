## ADDED Requirements

### Requirement: Tooltip component for security toggles
The system SHALL display an info icon (ⓘ) next to each security rule toggle in SecurityPage.

#### Scenario: User hovers over info icon
- **WHEN** user hovers over the info icon next to a security rule
- **THEN** system displays a tooltip with rule explanation

### Requirement: Tooltip content structure
Each tooltip SHALL contain:
1. A brief description of what the rule detects (1-2 sentences)
2. Example patterns that trigger the rule (2-3 examples)
3. A "Learn more" link to the corresponding docs section

#### Scenario: Tooltip for System prompt override
- **WHEN** user views tooltip for "System prompt override"
- **THEN** tooltip shows description, examples like "new system prompt", "enable developer mode", and link to docs

#### Scenario: Tooltip for API Keys masking
- **WHEN** user views tooltip for "API Keys" in Data Masking section
- **THEN** tooltip shows description, supported providers (OpenAI, Anthropic, Google, etc.), and link to docs

### Requirement: Tooltip positioning
The tooltip SHALL position itself to remain visible within the viewport.

#### Scenario: Tooltip near edge of screen
- **WHEN** user hovers info icon near the right edge of screen
- **THEN** tooltip positions itself to the left to remain fully visible

### Requirement: Tooltip content for all rules
The system SHALL provide tooltip content for all 12 security rules:
- Prompt Injection: ignore_instructions, system_override, role_hijacking, jailbreak
- Data Masking: api_keys, credit_cards, personal_data, crypto, env_vars
- Tool Restrictions: block_filesystem, block_network, block_code_execution

#### Scenario: All toggles have tooltips
- **WHEN** SecurityPage is rendered
- **THEN** every toggle row displays an info icon with corresponding tooltip content

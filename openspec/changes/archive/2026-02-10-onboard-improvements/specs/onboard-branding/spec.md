## ADDED Requirements

### Requirement: ASCII logo display
The onboard command SHALL display an ASCII art logo at startup before any prompts.

#### Scenario: Logo appears on onboard start
- **WHEN** user runs `agentgazer onboard`
- **THEN** system displays ASCII eye logo with "AgentGazer" text and tagline

### Requirement: Logo uses brand colors
The ASCII logo SHALL use ANSI color codes matching the dashboard color scheme.

#### Scenario: Colors render in supported terminals
- **WHEN** terminal supports ANSI colors
- **THEN** eye shape displays in blue, title in white bold, tagline in gray

#### Scenario: Fallback for unsupported terminals
- **WHEN** terminal does not support ANSI colors
- **THEN** logo displays in plain text without colors (still readable)

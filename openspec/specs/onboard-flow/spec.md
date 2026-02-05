## ADDED Requirements

### Requirement: Onboard generates config and shows SDK snippet
The `agenttrace onboard` command SHALL create `~/.agenttrace/config.json` with a generated token (if not already present), print the config summary, and display a copyable SDK code snippet showing how to connect.

#### Scenario: First-time onboard
- **WHEN** user runs `agenttrace onboard` with no existing config
- **THEN** a token SHALL be generated, config SHALL be saved to `~/.agenttrace/config.json`, and the CLI SHALL print:
  1. The full token
  2. Server and proxy port defaults
  3. A TypeScript SDK code snippet with the token and endpoint pre-filled

#### Scenario: Onboard with existing config
- **WHEN** user runs `agenttrace onboard` and `~/.agenttrace/config.json` already exists
- **THEN** the CLI SHALL read the existing config and print the same summary and SDK snippet without regenerating the token

### Requirement: SDK snippet is copy-pasteable
The SDK code snippet printed by onboard SHALL be a valid TypeScript block that the user can paste directly into their project.

#### Scenario: Snippet content
- **WHEN** the onboard snippet is printed
- **THEN** it SHALL include `import { AgentTrace } from "@agenttrace/sdk"`, `AgentTrace.init(...)` with `apiKey` set to the user's token and `endpoint` set to `http://localhost:8080/api/events`, and a `track()` example call

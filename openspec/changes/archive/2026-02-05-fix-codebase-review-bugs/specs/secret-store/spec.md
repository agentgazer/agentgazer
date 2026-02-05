## MODIFIED Requirements

### Requirement: Migration from plaintext config

The system SHALL auto-detect plaintext API keys in `config.json` and migrate them to the active secret store backend. The migration function MUST use the exported `PROVIDER_SERVICE` constant for the service name, not a locally defined duplicate.

#### Scenario: Migration uses shared constant
- **WHEN** `migrateFromPlaintextConfig` stores keys in the secret store
- **THEN** it uses the exported `PROVIDER_SERVICE` constant as the service parameter
- **AND** keys stored by migration are retrievable via `loadProviderKeys` (which also uses `PROVIDER_SERVICE`)

## 1. Update Config Interface

- [x] 1.1 Add optional fields to AgentGazerConfig interface in config.ts: port, proxyPort, autoOpen, retentionDays
- [x] 1.2 Update readConfig() to include new fields when parsing config file

## 2. Update CLI Start Command

- [x] 2.1 Read config values in cmdStart() and use as defaults (before CLI flag parsing)
- [x] 2.2 Update daemon mode to also respect config values
- [x] 2.3 Ensure CLI flags override config values (existing behavior)

## 3. Documentation

- [x] 3.1 Update CLI help text to mention config file defaults
- [x] 3.2 Add config file documentation to docs

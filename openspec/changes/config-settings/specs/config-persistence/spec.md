## ADDED Requirements

### Requirement: Config file supports port setting
The system SHALL read `port` from config.json and use it as the default dashboard port.

#### Scenario: Port from config
- **WHEN** config.json contains `"port": 9000` and user runs `agentgazer start` without --port flag
- **THEN** dashboard SHALL start on port 9000

#### Scenario: CLI flag overrides config
- **WHEN** config.json contains `"port": 9000` and user runs `agentgazer start --port 8000`
- **THEN** dashboard SHALL start on port 8000

### Requirement: Config file supports proxyPort setting
The system SHALL read `proxyPort` from config.json and use it as the default LLM proxy port.

#### Scenario: ProxyPort from config
- **WHEN** config.json contains `"proxyPort": 5000` and user runs `agentgazer start` without --proxy-port flag
- **THEN** proxy SHALL start on port 5000

#### Scenario: CLI flag overrides proxyPort config
- **WHEN** config.json contains `"proxyPort": 5000` and user runs `agentgazer start --proxy-port 6000`
- **THEN** proxy SHALL start on port 6000

### Requirement: Config file supports autoOpen setting
The system SHALL read `autoOpen` from config.json to control automatic browser opening.

#### Scenario: AutoOpen disabled in config
- **WHEN** config.json contains `"autoOpen": false` and user runs `agentgazer start`
- **THEN** system SHALL NOT auto-open browser

#### Scenario: CLI flag overrides autoOpen config
- **WHEN** config.json contains `"autoOpen": true` and user runs `agentgazer start --no-open`
- **THEN** system SHALL NOT auto-open browser

### Requirement: Config file supports retentionDays setting
The system SHALL read `retentionDays` from config.json and use it as the default data retention period.

#### Scenario: RetentionDays from config
- **WHEN** config.json contains `"retentionDays": 7` and user runs `agentgazer start`
- **THEN** system SHALL use 7 days retention period

#### Scenario: CLI flag overrides retentionDays config
- **WHEN** config.json contains `"retentionDays": 7` and user runs `agentgazer start --retention-days 14`
- **THEN** system SHALL use 14 days retention period

### Requirement: Missing config values use hardcoded defaults
The system SHALL use hardcoded defaults when config values are not present.

#### Scenario: Empty config uses defaults
- **WHEN** config.json only contains `"token"` field
- **THEN** system SHALL use port=18800, proxyPort=4000, autoOpen=true, retentionDays=30

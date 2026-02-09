## ADDED Requirements

### Requirement: Automatic event cleanup
System SHALL automatically delete events older than the configured retention period.

#### Scenario: Cleanup on server start
- **WHEN** server starts
- **THEN** system deletes events older than retention_days setting

#### Scenario: Daily cleanup
- **WHEN** 24 hours have passed since last cleanup
- **THEN** system deletes events older than retention_days setting

### Requirement: Configurable retention period
User SHALL be able to configure the retention period in days.

#### Scenario: Default retention
- **WHEN** no retention_days is configured
- **THEN** system uses 30 days as default

#### Scenario: Custom retention
- **WHEN** retention_days is set to 7 in config
- **THEN** system deletes events older than 7 days during cleanup

### Requirement: Retention config storage
Retention configuration SHALL be stored in ~/.agentgazer/config.json.

#### Scenario: Read config
- **WHEN** server starts
- **THEN** system reads retention_days from config.json

#### Scenario: Config not present
- **WHEN** retention_days is not in config.json
- **THEN** system uses default value of 30 days

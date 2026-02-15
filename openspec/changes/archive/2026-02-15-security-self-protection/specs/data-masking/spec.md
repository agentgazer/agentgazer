## ADDED Requirements

### Requirement: Detect hardware fingerprinting commands
The system SHALL detect commands that collect hardware serial numbers and machine identifiers.

Windows patterns:
- `wmic bios get serialnumber`
- `wmic baseboard get serialnumber`
- `wmic csproduct get uuid`
- `Get-WmiObject Win32_BIOS`
- `Get-WmiObject Win32_BaseBoard`
- `Get-CimInstance Win32_BIOS`
- `Get-CimInstance Win32_BaseBoard`

macOS patterns:
- `system_profiler SPHardwareDataType`
- `ioreg -l` with `IOPlatformSerialNumber`

Linux patterns:
- `dmidecode`
- `/sys/class/dmi/id/product_serial`
- `/sys/class/dmi/id/board_serial`
- `/sys/class/dmi/id/product_uuid`

#### Scenario: Windows BIOS serial command detected
- **WHEN** request contains `wmic bios get serialnumber`
- **THEN** the command SHALL be masked with replacement text
- **AND** an alert SHALL be generated

#### Scenario: macOS hardware profiler detected
- **WHEN** request contains `system_profiler SPHardwareDataType`
- **THEN** the command SHALL be masked

#### Scenario: Linux DMI path detected
- **WHEN** request contains `/sys/class/dmi/id/product_serial`
- **THEN** the path SHALL be masked

### Requirement: Hardware fingerprint category enabled by default
The `hardware_fingerprint` data masking category SHALL be enabled by default for all agents.

#### Scenario: New agent has hardware fingerprint protection
- **WHEN** a new agent is created
- **THEN** data_masking.rules.hardware_fingerprint SHALL be true

### Requirement: Hardware fingerprint masking generates alert
When hardware fingerprint patterns are masked, the system SHALL generate an alert in addition to masking.

#### Scenario: Alert on hardware fingerprint detection
- **WHEN** a hardware fingerprint pattern is masked
- **THEN** a security event SHALL be logged with:
  - event_type: "data_masked"
  - rule_name: the specific pattern name (e.g., "wmic_bios_serial")
  - severity: "warning"
- **AND** an alert SHALL be generated if alerting is enabled

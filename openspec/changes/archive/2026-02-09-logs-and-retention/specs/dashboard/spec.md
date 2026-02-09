## MODIFIED Requirements

### Requirement: Recent Events display
Recent Events component SHALL display events in a compact 2-line format to maximize visible events.

#### Scenario: Event display format
- **WHEN** Recent Events component renders an event
- **THEN** first line shows: Icon + Event Type + Agent Name + Relative Time (separated by ·)
- **AND** second line shows: Event message

#### Scenario: Compact spacing
- **WHEN** Multiple events are displayed
- **THEN** vertical spacing between events is reduced for density

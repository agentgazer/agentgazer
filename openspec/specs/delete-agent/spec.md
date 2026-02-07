# delete-agent Specification

## Purpose
TBD - created by archiving change dashboard-delete-actions. Update Purpose after archive.
## Requirements
### Requirement: Delete Agent API endpoint

The server SHALL provide a DELETE /api/agents/:id endpoint to remove an agent and all related data.

#### Scenario: Successful agent deletion
- **WHEN** DELETE /api/agents/:id is called with valid agent ID
- **THEN** the agent record is deleted from `agents` table
- **AND** all events with matching agent_id are deleted
- **AND** all alert_rules with matching agent_id are deleted
- **AND** all alert_history with matching agent_id are deleted
- **AND** all agent_provider_settings with matching agent_id are deleted
- **AND** response status is 204 No Content

#### Scenario: Agent not found
- **WHEN** DELETE /api/agents/:id is called with non-existent agent ID
- **THEN** response status is 404 Not Found

### Requirement: Delete Agent button in Dashboard

The Agent Detail page SHALL display a Delete Agent button.

#### Scenario: Delete button visibility
- **WHEN** user views Agent Detail page
- **THEN** a "Delete Agent" button is visible in the page header or settings section

#### Scenario: Delete confirmation dialog
- **WHEN** user clicks "Delete Agent" button
- **THEN** a confirmation dialog appears with warning message
- **AND** message includes agent ID
- **AND** message warns that all related data will be deleted

#### Scenario: Confirm deletion
- **WHEN** user confirms deletion in dialog
- **THEN** DELETE /api/agents/:id is called
- **AND** on success, user is navigated to Agents list page

#### Scenario: Cancel deletion
- **WHEN** user cancels deletion in dialog
- **THEN** no API call is made
- **AND** user remains on Agent Detail page


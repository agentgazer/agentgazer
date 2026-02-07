## ADDED Requirements

### Requirement: Delete Provider API endpoint

The server SHALL provide a DELETE /api/providers/:provider endpoint to remove a provider and related settings.

#### Scenario: Successful provider deletion
- **WHEN** DELETE /api/providers/:provider is called with valid provider name
- **THEN** the provider record is deleted from `providers` table
- **AND** all agent_provider_settings with matching provider are deleted
- **AND** response status is 204 No Content

#### Scenario: Provider not found
- **WHEN** DELETE /api/providers/:provider is called with non-existent provider
- **THEN** response status is 404 Not Found

### Requirement: Delete Provider button in Dashboard

The Provider Detail page SHALL display a Delete Provider button.

#### Scenario: Delete button visibility
- **WHEN** user views Provider Detail page
- **THEN** a "Delete Provider" button is visible in the settings section

#### Scenario: Delete confirmation dialog
- **WHEN** user clicks "Delete Provider" button
- **THEN** a confirmation dialog appears with warning message
- **AND** message includes provider name

#### Scenario: Confirm deletion
- **WHEN** user confirms deletion in dialog
- **THEN** DELETE /api/providers/:provider is called
- **AND** on success, user is navigated to Providers list page

#### Scenario: Cancel deletion
- **WHEN** user cancels deletion in dialog
- **THEN** no API call is made
- **AND** user remains on Provider Detail page

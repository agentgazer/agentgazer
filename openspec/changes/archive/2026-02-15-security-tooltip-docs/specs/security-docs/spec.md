## ADDED Requirements

### Requirement: Security documentation page
The system SHALL provide a Security guide page in the documentation site, available in both English and Chinese.

#### Scenario: User navigates to security docs
- **WHEN** user clicks "Security" in docs sidebar
- **THEN** user sees comprehensive security feature documentation

### Requirement: Documentation content structure
The security docs page SHALL include:
1. Overview of Security Shield feature
2. Prompt Injection Detection section with all 4 categories explained
3. Sensitive Data Masking section with all 5 data types explained
4. Tool Call Restrictions section with all 3 restriction types explained
5. Configuration guidance (when to enable/disable rules)
6. Best practices for production deployments

#### Scenario: Prompt injection section content
- **WHEN** user reads Prompt Injection section
- **THEN** user sees explanation of each category (ignore_instructions, system_override, role_hijacking, jailbreak) with specific patterns and examples

#### Scenario: Data masking section content
- **WHEN** user reads Data Masking section
- **THEN** user sees explanation of each data type with supported formats and provider examples

### Requirement: Bilingual documentation
The docs page SHALL be available in English (`en/guide/security.md`) and Chinese (`zh/guide/security.md`).

#### Scenario: Language switching
- **WHEN** user switches language in docs site
- **THEN** security page displays in selected language

### Requirement: Sidebar integration
The docs sidebar SHALL include a "Security" link in the Guide section.

#### Scenario: Sidebar shows security link
- **WHEN** user views docs sidebar
- **THEN** "Security" appears in Guide section, after existing items

### Requirement: Anchor links for tooltips
Each section in the docs SHALL have anchor IDs matching tooltip link targets.

#### Scenario: Tooltip link navigation
- **WHEN** user clicks "Learn more" link in tooltip for "System prompt override"
- **THEN** browser navigates to docs security page scrolled to system-override section

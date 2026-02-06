## ADDED Requirements

### Requirement: Dashboard assets included in CLI npm package
The published `agentgazer` npm package SHALL include pre-built dashboard-local static files so that `agentgazer start` serves the dashboard UI without any additional downloads.

#### Scenario: npm install includes dashboard
- **WHEN** a user installs `agentgazer` from npm
- **THEN** the package SHALL contain the dashboard HTML/JS/CSS files in a known location relative to the CLI entry point

#### Scenario: Dashboard served after start
- **WHEN** user runs `agentgazer start`
- **THEN** navigating to `http://localhost:8080` in a browser SHALL show the AgentGazer dashboard

### Requirement: Build pipeline produces dashboard before CLI
The monorepo build pipeline SHALL build `dashboard-local` before `packages/cli`, and the CLI build step SHALL copy dashboard-local dist into its own dist directory.

#### Scenario: Turbo build order
- **WHEN** `npm run build` is executed at the repo root
- **THEN** `dashboard-local` SHALL build before `packages/cli`, and `packages/cli/dist/dashboard/` SHALL contain the dashboard build output

### Requirement: Remove old Next.js dashboard
The `apps/dashboard/` directory SHALL be removed from the repository. All references to it in root config files (package.json workspaces, turbo.json) SHALL be cleaned up.

#### Scenario: Old dashboard deleted
- **WHEN** the change is applied
- **THEN** `apps/dashboard/` SHALL not exist, and `npm run build` SHALL succeed without it

## ADDED Requirements

### Requirement: Automated Docker image build on release

GitHub Actions workflow SHALL automatically build Docker image when a version tag is pushed.

#### Scenario: Version tag triggers build
- **WHEN** a git tag matching `v*` pattern is pushed (e.g., `v1.0.0`)
- **THEN** GitHub Actions workflow is triggered
- **AND** Docker image is built using the repository Dockerfile

### Requirement: Docker image push to GitHub Container Registry

The workflow SHALL push built images to ghcr.io under `ghcr.io/agentgazer/agentgazer`.

#### Scenario: Successful image push
- **WHEN** Docker image build succeeds
- **THEN** image is pushed to `ghcr.io/agentgazer/agentgazer` repository
- **AND** image is tagged with version number (without `v` prefix, e.g., `1.0.0`)
- **AND** image is also tagged as `latest`

#### Scenario: Build failure handling
- **WHEN** Docker build fails
- **THEN** workflow fails with error message
- **AND** no image is pushed to ghcr.io

### Requirement: GitHub Container Registry authentication

The workflow SHALL authenticate to ghcr.io using the built-in GITHUB_TOKEN.

#### Scenario: Automatic authentication
- **WHEN** workflow runs
- **THEN** it uses `GITHUB_TOKEN` for authentication
- **AND** no additional secrets configuration is required

### Requirement: OCI image labels

Dockerfile SHALL include OCI standard labels for image metadata.

#### Scenario: Labels present in built image
- **WHEN** image is built
- **THEN** image contains `org.opencontainers.image.source` label pointing to GitHub repo
- **AND** image contains `org.opencontainers.image.version` label with version number
- **AND** image contains `org.opencontainers.image.title` label with "AgentGazer"
- **AND** image contains `org.opencontainers.image.description` label

### Requirement: Standalone docker-compose example

A standalone `docker-compose.example.yml` SHALL be provided for users without cloning the repo.

#### Scenario: User downloads and runs example
- **WHEN** user downloads `docker-compose.example.yml`
- **AND** user runs `docker compose -f docker-compose.example.yml up -d`
- **THEN** AgentGazer starts using `agentgazer/agentgazer:latest` image
- **AND** data is persisted in a named volume

### Requirement: Documentation update

Docker documentation SHALL be updated with simplified installation instructions.

#### Scenario: Quick start with GitHub Container Registry
- **WHEN** user visits docker.md documentation
- **THEN** user sees `docker pull ghcr.io/agentgazer/agentgazer` as primary installation method
- **AND** user sees simple docker-compose example using the published image

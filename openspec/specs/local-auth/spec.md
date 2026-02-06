## ADDED Requirements

### Requirement: Token auto-generation on first run
The CLI SHALL generate a cryptographically random token (32 bytes, hex-encoded) on first run and store it in `~/.agentgazer/config.json` as `{ "token": "<hex>" }`. If the config file already exists with a valid token, the existing token SHALL be reused.

#### Scenario: First run generates token
- **WHEN** the CLI starts and `~/.agentgazer/config.json` does not exist
- **THEN** a new random token is generated, saved to config, and printed to the terminal

#### Scenario: Subsequent run reuses token
- **WHEN** the CLI starts and `~/.agentgazer/config.json` exists with a valid token
- **THEN** the existing token is used and printed to the terminal

### Requirement: Token reset command
The CLI SHALL support a `--reset-token` flag that generates a new token, replacing the existing one in `~/.agentgazer/config.json`.

#### Scenario: Reset token
- **WHEN** the CLI is invoked with `--reset-token`
- **THEN** a new token is generated, saved to config, the old token is invalidated, and the new token is printed

### Requirement: API bearer token authentication

All API endpoints (except `/api/health` and `/api/auth/verify`) SHALL require a valid auth token via `Authorization: Bearer <token>` or `x-api-key` header. Token comparison MUST use a constant-time algorithm (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

#### Scenario: Token comparison is constant-time
- **WHEN** the server compares a provided token against the stored token
- **THEN** the comparison uses `crypto.timingSafeEqual` (or equivalent constant-time function)
- **AND** tokens of different lengths are rejected without leaking length information

#### Scenario: Valid token accepted
- **WHEN** a request includes a valid Bearer token
- **THEN** the request is authorized

#### Scenario: Invalid token rejected
- **WHEN** a request includes an invalid Bearer token
- **THEN** the server responds with HTTP 401

### Requirement: Dashboard token verification endpoint
The server SHALL expose `POST /api/auth/verify` (no auth required) that accepts `{ token: "<string>" }` and returns `{ valid: true }` if the token matches, or `{ valid: false }` with status 401 otherwise.

#### Scenario: Correct token verification
- **WHEN** a POST to `/api/auth/verify` contains the correct token
- **THEN** the server returns `{ valid: true }` with status 200

#### Scenario: Incorrect token verification
- **WHEN** a POST to `/api/auth/verify` contains an incorrect token
- **THEN** the server returns `{ valid: false }` with status 401

### Requirement: Dashboard login page
The dashboard SHALL display a login page at `/login` when no valid token is stored in the browser. The login page SHALL have a single text input for the token and a submit button. On successful verification (via `POST /api/auth/verify`), the token SHALL be stored in `localStorage` and the user SHALL be redirected to `/`.

#### Scenario: Successful login
- **WHEN** the user enters the correct token and clicks "Login"
- **THEN** the token is stored in localStorage and the user is redirected to the overview page

#### Scenario: Failed login
- **WHEN** the user enters an incorrect token and clicks "Login"
- **THEN** an error message is displayed: "Invalid token"

### Requirement: Dashboard auth guard
All dashboard pages (except `/login`) SHALL check for a valid token in localStorage. If no token is present, the user SHALL be redirected to `/login`. The token SHALL be included in all API requests as `Authorization: Bearer <token>`.

#### Scenario: No token redirects to login
- **WHEN** a user navigates to `/agents` without a stored token
- **THEN** the user is redirected to `/login`

#### Scenario: Token included in API requests
- **WHEN** the dashboard fetches data from `/api/agents`
- **THEN** the request includes `Authorization: Bearer <stored-token>` header

### Requirement: Logout
The dashboard sidebar SHALL include a logout action that clears the token from localStorage and redirects to `/login`.

#### Scenario: Logout clears session
- **WHEN** the user clicks "Logout"
- **THEN** the token is removed from localStorage and the user is redirected to `/login`

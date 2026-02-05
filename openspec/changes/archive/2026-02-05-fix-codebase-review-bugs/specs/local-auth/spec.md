## MODIFIED Requirements

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

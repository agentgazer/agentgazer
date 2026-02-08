## Context

OpenClaw users currently need to manually edit `~/.openclaw/openclaw.json` to integrate with AgentGazer. This involves:
1. Knowing the correct `baseUrl` format (`http://localhost:4000/<provider>`)
2. Understanding the `api` field values (`anthropic-messages`, `openai-completions`)
3. Correctly setting up the `models.providers` structure

This is error-prone and requires reading documentation carefully.

## Goals / Non-Goals

**Goals:**
- Provide a one-click integration experience for OpenClaw users
- Auto-generate correct configuration based on AgentGazer's configured providers
- Preserve existing OpenClaw configuration when updating `models` key
- Handle edge cases (missing file, missing directory, existing but different config)

**Non-Goals:**
- Managing OpenClaw's `agents` configuration (only `models.providers`)
- Detecting if OpenClaw is installed (users can access this feature even if OpenClaw isn't installed yet)
- Validating that the generated config actually works with OpenClaw

## Decisions

### 1. File path: Use `~/.openclaw/openclaw.json`
**Rationale**: This is OpenClaw's standard config location. Using `os.homedir()` in Node.js to resolve `~`.

### 2. Only modify `models` key
**Rationale**: User explicitly wants to focus on the `models` key only. This minimizes risk of breaking other OpenClaw settings.

### 3. Use `mode: "merge"` in models config
**Rationale**: OpenClaw supports `mode: "merge"` which adds providers without replacing built-in ones. This is safer than `mode: "replace"`.

### 4. Provider naming: `<provider>-traced` suffix
**Rationale**: Using a suffix like `anthropic-traced` makes it clear these are AgentGazer-proxied providers while avoiding name conflicts with built-in OpenClaw providers.

### 5. API protocol mapping
| Provider | API Field |
|----------|-----------|
| anthropic | `anthropic-messages` |
| openai | `openai-completions` |
| google | `google-ai` |
| mistral | `mistral` |
| cohere | `cohere` |
| deepseek | `openai-completions` (OpenAI-compatible) |
| moonshot | `openai-completions` (OpenAI-compatible) |
| Others | `openai-completions` (default, most are OpenAI-compatible) |

### 6. Localhost-only API
**Rationale**: Writing to `~/.openclaw/openclaw.json` is a security-sensitive operation. Restricting to loopback (reusing existing `requireLoopback` middleware from providers routes) prevents remote access.

## Risks / Trade-offs

**[Risk] OpenClaw config syntax may vary** → We only manage the `models` key; other config stays untouched. If `models` key has unexpected structure, we overwrite it completely.

**[Risk] File permissions** → Creating `~/.openclaw` directory and writing config file requires appropriate permissions. Mitigation: Handle EACCES errors gracefully.

**[Risk] OpenClaw not restarted** → Config changes require OpenClaw restart to take effect. Mitigation: Show clear message after applying config.

## Implementation Notes

### Server Route Structure
Add new route file `packages/server/src/routes/openclaw.ts`:
- `GET /api/openclaw/config` - Read current config
- `PUT /api/openclaw/config` - Update models key

### Dashboard Page
Add new page `apps/dashboard-local/src/pages/OpenClaw.tsx`:
- Fetch configured providers from `/api/providers`
- Fetch current OpenClaw config from `/api/openclaw/config`
- Generate `models.providers` config based on configured providers
- Show preview of config to be applied
- "Apply Configuration" button calls `PUT /api/openclaw/config`

### Generated Config Structure
```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "api": "anthropic-messages"
      },
      "openai-traced": {
        "baseUrl": "http://localhost:4000/openai",
        "api": "openai-completions"
      }
    }
  }
}
```

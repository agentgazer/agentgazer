# Design: Provider Management Dashboard

## Architecture

### Data Flow
```
CLI/Dashboard → Server API → Secret Store (keys) + SQLite (models, stats)
                    ↓
            Provider APIs (validation)
```

### New Database Tables

```sql
-- Custom models added by user per provider
CREATE TABLE provider_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, model_id)
);

-- Provider-level settings (active toggle, rate limit)
CREATE TABLE provider_settings (
  provider TEXT PRIMARY KEY,
  active INTEGER DEFAULT 1,
  rate_limit_max_requests INTEGER,
  rate_limit_window_seconds INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers` | List providers with status |
| POST | `/api/providers/:name/validate` | Validate API key |
| GET | `/api/providers/:name/models` | List models for provider |
| POST | `/api/providers/:name/models` | Add custom model |
| DELETE | `/api/providers/:name/models/:modelId` | Remove custom model |
| POST | `/api/providers/:name/models/:modelId/test` | Test if model exists |
| GET | `/api/providers/:name/stats` | Provider usage & cost stats |
| GET | `/api/providers/:name/settings` | Get provider settings |
| PATCH | `/api/providers/:name/settings` | Update active, rate limit |

### Provider Validation Strategy

| Provider | Method | Consumes Tokens |
|----------|--------|-----------------|
| OpenAI | GET /v1/models | No |
| Anthropic | POST /v1/messages (haiku, max_tokens=1) | ~$0.000001 |
| Google | GET /v1/models | No |
| Mistral | GET /v1/models | No |
| Cohere | GET /v1/models | No |
| DeepSeek | GET /v1/models | No |
| Others | GET /models or minimal request | Varies |

### Model Testing Strategy
- For providers with `/models` endpoint: Check if model exists in list
- For others: Send minimal request with max_tokens=1

### Dashboard Pages

**1. Providers List (/providers)**
- Card per provider showing: name, status (connected/error/not configured), last checked
- Click card → Provider Detail

**2. Provider Detail (/providers/:name)**
- Header: Provider name, status badge, "Test Connection" button
- Section: Models
  - List of known models (from shared/models.ts) + custom models
  - Input to add new model + "Test" button
- Section: Usage Stats
  - Total requests, tokens, cost (filtered by this provider)
  - Time range selector (1h, 24h, 7d, 30d)
  - Charts: requests over time, cost breakdown by model

## Proxy Enforcement

The proxy checks provider settings before forwarding requests:

1. **Active Check** — If provider `active=0`, return blocked response
2. **Rate Limit Check** — If provider rate limit exceeded, return 429

Priority order:
1. Provider active check
2. Provider rate limit
3. Agent active check (existing)
4. Agent rate limit (existing)
5. Forward request

Block reasons:
- `provider_deactivated` — Provider is inactive
- `provider_rate_limited` — Provider rate limit exceeded

## Security

### Loopback-Only Key Management
API key management (add/remove providers) is restricted to loopback connections:

```typescript
const isLoopback = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};
```

| Connection | Add/Remove Provider | View/Settings |
|------------|---------------------|---------------|
| Loopback (localhost) | Allowed | Allowed |
| LAN (192.168.x.x) | Blocked (403) | Allowed |

**Dashboard UX:**
- "Add Provider" button always visible
- LAN connection: button disabled (grayed) with tooltip explaining restriction
- Loopback connection: button enabled, opens modal

### Other Security Measures
- API key validation happens server-side only
- Keys are never returned in API responses
- Validation requests use minimal tokens where unavoidable

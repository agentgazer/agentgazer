# Design: Security Shield

## Architecture

```
Request → Proxy
            │
            ▼
    ┌───────────────────┐
    │ Load Security     │ ← Agent-specific config, fallback to ALL
    │ Config (cached)   │
    └───────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ Data Masking      │ → Mask sensitive data in request
    │ (Request)         │ → Log security_event if matched
    └───────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ Tool Restrictions │ → Check tool call limits
    │ (Request)         │ → Block if violated
    └───────────────────┘
            │
            ▼
        Forward to LLM
            │
            ▼
    ┌───────────────────┐
    │ Prompt Injection  │ → Detect injection patterns
    │ (Response)        │ → Log/Alert/Block based on config
    └───────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ Data Masking      │ → Mask sensitive data in response
    │ (Response)        │
    └───────────────────┘
            │
            ▼
    Return to Agent
```

## Database Schema

```sql
-- Security configuration (one row per agent, NULL agent_id = global default)
CREATE TABLE security_config (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE,  -- NULL for ALL agents

  -- Prompt Injection
  prompt_injection_action TEXT DEFAULT 'log',  -- log|alert|block
  prompt_injection_rules TEXT,  -- JSON: {"ignore_instructions": true, ...}
  prompt_injection_custom TEXT, -- JSON array of custom regex patterns

  -- Data Masking
  data_masking_replacement TEXT DEFAULT '[REDACTED]',
  data_masking_rules TEXT,  -- JSON: {"api_keys": true, "credit_cards": true, ...}
  data_masking_custom TEXT, -- JSON array of {name, pattern}

  -- Tool Restrictions
  tool_restrictions_action TEXT DEFAULT 'block',  -- log|alert|block
  tool_restrictions_rules TEXT,  -- JSON: {"max_per_request": 10, ...}
  tool_allowlist TEXT,  -- JSON array of tool names
  tool_blocklist TEXT,  -- JSON array of tool names

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Security events log
CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- prompt_injection|data_masked|tool_blocked
  severity TEXT NOT NULL,    -- info|warning|critical
  action_taken TEXT NOT NULL, -- logged|alerted|blocked|masked
  rule_name TEXT,            -- which rule triggered
  matched_pattern TEXT,      -- what was matched
  snippet TEXT,              -- redacted snippet for context
  request_id TEXT,           -- link to original request
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_events_agent ON security_events(agent_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created ON security_events(created_at);
```

## Toggle Logic

```
Parent Toggle Behavior:
- Click ON  → All children ON,  parent shows ON
- Click OFF → All children OFF, parent shows OFF

Parent State Calculation:
- All children ON  → Parent ON  (filled circle)
- All children OFF → Parent OFF (empty circle)
- Mixed            → Parent PARTIAL (half-filled circle)

Clicking PARTIAL → turns all ON
```

## Built-in Patterns

### Prompt Injection
```typescript
const PROMPT_INJECTION_PATTERNS = {
  ignore_instructions: /ignore\s+(previous|all|above)\s+instructions/i,
  system_override: /system\s*:\s*|<\|system\|>/i,
  role_hijacking: /you\s+are\s+now\s+(a|an)\s+|pretend\s+(you're|to\s+be)/i,
  jailbreak: /\[INST\]|<\|im_start\|>|```system|DAN\s+mode/i,
};
```

### Sensitive Data
```typescript
const SENSITIVE_DATA_PATTERNS = {
  api_keys: {
    openai: /sk-[a-zA-Z0-9]{20,}/g,
    anthropic: /sk-ant-[a-zA-Z0-9-]{20,}/g,
    google: /AIza[a-zA-Z0-9_-]{35}/g,
    aws_access: /AKIA[A-Z0-9]{16}/g,
    aws_secret: /(?:aws_secret|secret_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    generic: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
  },
  credit_cards: {
    visa: /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
    mastercard: /\b5[1-5][0-9]{14}\b/g,
    amex: /\b3[47][0-9]{13}\b/g,
  },
  personal_data: {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone_us: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    taiwan_id: /[A-Z][12]\d{8}/g,
  },
  crypto: {
    btc_wif: /[5KL][1-9A-HJ-NP-Za-km-z]{50,51}/g,
    btc_xprv: /xprv[a-zA-Z0-9]{107}/g,
    eth_private: /(?:0x)?[a-fA-F0-9]{64}/g,
    solana_private: /[1-9A-HJ-NP-Za-km-z]{87,88}/g,
    seed_phrase: /\b(?:abandon|ability|able|about|above)(?:\s+[a-z]{3,8}){11,23}\b/gi,
  },
  env_vars: {
    database_url: /(?:DATABASE_URL|DB_URL|MONGO_URI)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
    secret_key: /(?:SECRET_KEY|JWT_SECRET|ENCRYPTION_KEY)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
  },
};
```

### Tool Categories
```typescript
const TOOL_CATEGORIES = {
  filesystem: ['read_file', 'write_file', 'delete_file', 'list_directory', 'move_file'],
  network: ['http_request', 'fetch_url', 'download', 'upload', 'send_email'],
  code_execution: ['run_code', 'execute_command', 'eval', 'exec', 'shell'],
  system: ['spawn_process', 'kill_process', 'get_env', 'set_env'],
};
```

## API Endpoints

```
GET  /api/security/config?agent_id=:id   - Get config (agent or global)
PUT  /api/security/config                - Update config
GET  /api/security/events                - List security events
GET  /api/security/events/:id            - Get event detail
```

## Cache Strategy

- Security config cached per-agent with 5s TTL
- Cache cleared on config update via internal endpoint
- Similar pattern to existing provider policy cache

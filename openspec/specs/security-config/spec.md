# Spec: Security Config

## Overview

Database schema and API for storing security configuration per agent.

## Schema

```sql
CREATE TABLE security_config (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE,  -- NULL for global default (ALL agents)

  -- Prompt Injection Detection
  prompt_injection_action TEXT DEFAULT 'log',  -- log|alert|block
  prompt_injection_rules TEXT,   -- JSON object with rule toggles
  prompt_injection_custom TEXT,  -- JSON array of custom patterns

  -- Sensitive Data Masking
  data_masking_replacement TEXT DEFAULT '[REDACTED]',
  data_masking_rules TEXT,   -- JSON object with category toggles
  data_masking_custom TEXT,  -- JSON array of {name, pattern}

  -- Tool Call Restrictions
  tool_restrictions_action TEXT DEFAULT 'block',
  tool_restrictions_rules TEXT,  -- JSON object with rule configs
  tool_allowlist TEXT,  -- JSON array of allowed tool names
  tool_blocklist TEXT,  -- JSON array of blocked tool names

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- prompt_injection|data_masked|tool_blocked
  severity TEXT NOT NULL,        -- info|warning|critical
  action_taken TEXT NOT NULL,    -- logged|alerted|blocked|masked
  rule_name TEXT,
  matched_pattern TEXT,
  snippet TEXT,
  request_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## API Endpoints

### GET /api/security/config

Query params:
- `agent_id` (optional): Get config for specific agent, or global if omitted

Response:
```json
{
  "agent_id": "my-agent",
  "prompt_injection": {
    "action": "alert",
    "rules": {
      "ignore_instructions": true,
      "system_override": true,
      "role_hijacking": false,
      "jailbreak": true
    },
    "custom": []
  },
  "data_masking": {
    "replacement": "[REDACTED]",
    "rules": {
      "api_keys": true,
      "credit_cards": true,
      "personal_data": true,
      "crypto": true,
      "env_vars": false
    },
    "custom": [
      {"name": "Internal Key", "pattern": "MYCO-[A-Z0-9]{32}"}
    ]
  },
  "tool_restrictions": {
    "action": "block",
    "rules": {
      "max_per_request": 10,
      "max_per_minute": 60,
      "block_filesystem": false,
      "block_network": false,
      "block_code_execution": true
    },
    "allowlist": [],
    "blocklist": ["execute_command", "shell"]
  }
}
```

### PUT /api/security/config

Request body: Same structure as GET response

Response: Updated config

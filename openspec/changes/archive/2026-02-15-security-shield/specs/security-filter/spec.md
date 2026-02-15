# Spec: Security Filter

## Overview

Proxy-side security filtering module that checks requests and responses against configured rules.

## Module: SecurityFilter

```typescript
interface SecurityCheckResult {
  allowed: boolean;
  events: SecurityEvent[];  // Events to log
  modified?: string;        // Modified content (for masking)
}

interface SecurityEvent {
  event_type: 'prompt_injection' | 'data_masked' | 'tool_blocked';
  severity: 'info' | 'warning' | 'critical';
  action_taken: 'logged' | 'alerted' | 'blocked' | 'masked';
  rule_name: string;
  matched_pattern?: string;
  snippet?: string;
}

class SecurityFilter {
  constructor(db: Database, endpoint: string);

  // Load config for agent (with fallback to global)
  getConfig(agentId: string): Promise<SecurityConfig>;

  // Check request before forwarding
  checkRequest(agentId: string, body: string): Promise<SecurityCheckResult>;

  // Check response before returning
  checkResponse(agentId: string, body: string): Promise<SecurityCheckResult>;

  // Individual checks
  checkPromptInjection(content: string, config: PromptInjectionConfig): SecurityEvent[];
  maskSensitiveData(content: string, config: DataMaskingConfig): { masked: string; events: SecurityEvent[] };
  checkToolRestrictions(toolCalls: ToolCall[], config: ToolRestrictionsConfig): SecurityEvent[];

  // Cache management
  clearCache(agentId?: string): void;
}
```

## Processing Flow

### Request Processing
```
1. Load security config (cached)
2. Parse request body
3. Run data masking on messages/prompts
4. Check tool call restrictions (if tool_use in request)
5. If any blocking event → return error
6. Otherwise → forward modified request
```

### Response Processing
```
1. Load security config (cached)
2. Parse response body
3. Run prompt injection detection on assistant content
4. Run data masking on response content
5. If blocking event → return error
6. Otherwise → return modified response
```

## Blocked Response Format

When security blocks a request:
```json
{
  "error": {
    "type": "security_blocked",
    "message": "Request blocked by security policy: prompt injection detected",
    "rule": "ignore_instructions",
    "action": "blocked"
  }
}
```

## Config Cache

- Cache TTL: 5 seconds
- Cache key: agent_id
- Clear via: POST /internal/security/clear-cache/:agentId

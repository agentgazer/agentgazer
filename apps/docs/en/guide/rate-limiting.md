# Rate Limiting

Rate Limiting prevents agents from overwhelming LLM providers and exhausting your API quotas.

## The Problem

AI agents can make requests faster than your API quota allows:

- **Burst traffic** — Agent processes a backlog and sends many requests at once
- **Retry storms** — Failed requests trigger retries, amplifying load
- **Runaway loops** — Agent stuck in a loop (see [Kill Switch](/en/guide/kill-switch))
- **Multi-agent contention** — Multiple agents compete for the same quota

Without rate limiting, you hit provider rate limits, get errors, and waste money on failed retries.

## How It Works

AgentGazer uses a **sliding window** algorithm:

```
Window: 60 seconds
Limit: 100 requests

Timeline:
[----60 seconds----]
 R R R R ... R R R  = 100 requests
                 ↑
              New request arrives
              → Rejected (429 Too Many Requests)
              → Retry-After: 45 seconds
```

1. Each request timestamp is recorded
2. When a new request arrives, timestamps older than the window are evicted
3. If remaining count ≥ max requests, request is rejected
4. Response includes `retry_after_seconds` calculated from when the oldest request expires

## Configuration

Configure Rate Limiting in the Dashboard: **Agent Detail → Rate Limit Settings**

| Control | Description |
|---------|-------------|
| **Provider Dropdown** | Select provider to add a rate limit |
| **Max Requests** | Maximum requests in the window |
| **Window (seconds)** | Sliding window duration |
| **Add / Remove** | Manage rate limit configurations |

### Example

"100 requests per 60 seconds" means:

- Agent can make up to 100 requests to that provider
- Within any 60-second sliding window
- Request #101 is rejected until an older request falls outside the window

## Response Format

When rate limited, the Proxy returns `429 Too Many Requests`:

**OpenAI format:**

```json
{
  "error": {
    "message": "Rate limit exceeded for agent \"my-bot\" on openai. Please retry after 45 seconds.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  },
  "retry_after_seconds": 45
}
```

**Anthropic format:**

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for agent \"my-bot\" on anthropic. Please retry after 45 seconds."
  },
  "retry_after_seconds": 45
}
```

The `Retry-After` HTTP header is also set.

## Scope

Rate limits are **per-agent per-provider**:

- Agent "code-bot" can have 100 req/min for OpenAI
- Agent "code-bot" can have 50 req/min for Anthropic
- Agent "chat-bot" has its own independent limits

This lets you allocate quota across agents based on priority.

## Provider-Level Rate Limits

In addition to per-agent limits, you can set **provider-level** rate limits:

**Dashboard → Providers → Provider Detail → Rate Limit**

This sets a global limit across all agents. Useful for:

- Staying within your overall API tier limit
- Preventing any single provider from being overwhelmed
- Emergency throttling

When both agent-level and provider-level limits exist, **both are enforced** — the request must pass both checks.

## Block Reason

Rate-limited requests are recorded with block reason `rate_limited`:

- Visible in Agent Detail → Blocked Events
- Can be filtered in Request Log
- Included in event export

## API

Rate limits can also be managed via API:

```bash
# List rate limits for an agent
GET /api/agents/:agentId/rate-limits

# Set rate limit
PUT /api/agents/:agentId/rate-limits/:provider
{
  "max_requests": 100,
  "window_seconds": 60
}

# Remove rate limit
DELETE /api/agents/:agentId/rate-limits/:provider
```

## Best Practices

### Setting Appropriate Limits

| Tier | Suggested Limit | Use Case |
|------|-----------------|----------|
| Conservative | 10 req/min | Development, testing |
| Moderate | 60 req/min | Production batch jobs |
| Aggressive | 300 req/min | High-throughput agents |

### Monitoring

Check the Dashboard for:

- **Blocked Events count** — High numbers indicate limit is too low
- **Block reason breakdown** — `rate_limited` vs other reasons
- **Request patterns** — Identify burst traffic times

### Combining with Kill Switch

Rate Limiting and Kill Switch work together:

- **Rate Limiting** — Prevents quota exhaustion
- **Kill Switch** — Stops infinite loops

An agent in a loop will hit the rate limit first, slowing it down. If the loop persists, Kill Switch detects the pattern and deactivates the agent.

## Comparison with Other Tools

| Feature | Langsmith | Langfuse | Helicone | AgentGazer |
|---------|:---------:|:--------:|:--------:|:----------:|
| Rate Limiting | ❌ | ❌ | ❌ | ✅ |
| Per-Agent Limits | ❌ | ❌ | ❌ | ✅ |
| Sliding Window | ❌ | ❌ | ❌ | ✅ |
| Retry-After Header | ❌ | ❌ | ❌ | ✅ |

Other tools don't touch your requests — they can only report after the fact. AgentGazer actively enforces rate limits before requests reach the provider.

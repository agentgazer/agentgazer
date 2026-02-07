# Model Override

Model Override lets you replace expensive models with cheaper alternatives — without changing your agent code.

## The Problem

Your AI agent is hardcoded to use `gpt-4o`, but you want to:

- **Cut costs** by switching to `gpt-4o-mini`
- **Test** how the agent behaves with different models
- **Rollback** quickly if a new model causes issues

Normally, you'd have to modify the agent code, redeploy, and hope nothing breaks. With Model Override, you change it in the Dashboard and it takes effect immediately.

## How It Works

```
Agent requests: gpt-4           Your override rule: openai → gpt-4o-mini
      ↓                                    ↓
   Proxy intercepts ──────────────────→ Rewrites to gpt-4o-mini
      ↓
   Sent to OpenAI
      ↓
   Event recorded: requested_model=gpt-4, model=gpt-4o-mini
```

1. Agent sends request with original model (e.g., `gpt-4`)
2. Proxy checks for override rules for this agent + provider
3. If rule exists, Proxy rewrites the `model` field in the request body
4. Request is forwarded to provider with the overridden model
5. Event is recorded with both models for auditability

## Configuration

Configure Model Override in the Dashboard: **Agent Detail → Model Settings**

For each provider the agent has used, you'll see:

| Control | Description |
|---------|-------------|
| **Model Dropdown** | Select override model or "None" |
| **Override Active Badge** | Shows when an override is in effect |

### Setting an Override

1. Go to Agent Detail page
2. Scroll to Model Settings section
3. Select the desired model from the dropdown
4. The override takes effect immediately

### Removing an Override

1. Select "None" from the dropdown
2. Agent will use its original model

## Request Log

The Request Log shows both models when an override is active:

```
gpt-4 → gpt-4o-mini   500 / 200 tokens   $0.0015
```

This makes it easy to audit what the agent requested vs. what was actually used.

## Use Cases

### Cost Control

Force agents to use cheaper models:

| Original | Override | Savings |
|----------|----------|---------|
| gpt-4o | gpt-4o-mini | ~90% |
| claude-opus-4-5 | claude-haiku | ~95% |
| gemini-1.5-pro | gemini-1.5-flash | ~85% |

### A/B Testing

Compare agent behavior across models:

1. Run agent with original model, record metrics
2. Apply override to cheaper model
3. Compare success rate, latency, cost
4. Make data-driven decision

### Quick Rollback

If a new model causes issues:

1. Agent code deploys with new model
2. Problems detected (errors, poor responses)
3. Apply override to previous model from Dashboard
4. Agent immediately uses old model — no code change needed

## Per-Agent Per-Provider

Override rules are scoped to **agent + provider**:

- Agent "code-bot" can have different overrides for OpenAI vs Anthropic
- Agent "chat-bot" can have its own independent overrides
- Changing one agent's override doesn't affect others

## API

Model Override can also be managed via API:

```bash
# List rules for an agent
GET /api/agents/:agentId/model-rules

# Set override
PUT /api/agents/:agentId/model-rules/:provider
{
  "model_override": "gpt-4o-mini"
}

# Remove override
DELETE /api/agents/:agentId/model-rules/:provider

# Get available models
GET /api/models
```

## Comparison with Other Tools

| Feature | Langsmith | Langfuse | Helicone | AgentGazer |
|---------|:---------:|:--------:|:--------:|:----------:|
| Model Override | ❌ | ❌ | ❌ | ✅ |
| Request Rewriting | ❌ | ❌ | ❌ | ✅ |
| Per-Agent Rules | ❌ | ❌ | ❌ | ✅ |

Other tools are read-only observers. AgentGazer actively modifies requests to implement your policies.

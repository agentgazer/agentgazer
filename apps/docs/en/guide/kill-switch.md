# Kill Switch

Kill Switch automatically detects and stops runaway AI agents before they burn your budget.

## The Problem

AI agents can get stuck in infinite loops — making the same API calls repeatedly, running up costs without producing useful results. Common causes:

- Agent keeps retrying failed actions
- Circular reasoning in multi-step workflows
- Tool calls that always return the same result
- Prompt templates that generate identical requests

Traditional observability tools can only **watch** this happen. AgentGazer can **stop** it.

## How It Works

Kill Switch uses **SimHash** — a locality-sensitive hashing algorithm — to detect repeated patterns.

### Detection Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| Similar Prompts | ×1.0 | Prompts with Hamming distance < 3 after normalization |
| Similar Responses | ×2.0 | LLM responses with Hamming distance < 3 |
| Repeated Tool Calls | ×1.5 | Identical tool/function call signatures |

### Scoring Formula

```
Score = similar_prompts × 1.0 + similar_responses × 2.0 + repeated_tool_calls × 1.5
```

When the score exceeds the configured threshold, the agent is automatically deactivated.

### Prompt Normalization

Before hashing, prompts are normalized to detect semantic repetition:

| Pattern | Replacement | Example |
|---------|-------------|---------|
| Numbers | `<NUM>` | "order #12345" → "order #`<NUM>`" |
| ISO Timestamps | `<TS>` | "2024-01-15T10:30:00Z" → "`<TS>`" |
| UUIDs | `<ID>` | "550e8400-e29b-..." → "`<ID>`" |
| Whitespace | Single space | Multiple spaces collapsed |

This ensures that requests differing only in dynamic values are recognized as similar.

## Configuration

Configure Kill Switch in the Dashboard: **Agent Detail → Kill Switch Settings**

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Enable** | Off | Toggle to activate loop detection |
| **Window Size** | 20 | Number of recent requests to analyze |
| **Threshold** | 10.0 | Score threshold for deactivation |

### Tuning Tips

- **Lower threshold** = More aggressive detection (may have false positives)
- **Higher threshold** = More tolerant (may miss some loops)
- **Smaller window** = Detects short loops faster
- **Larger window** = Catches longer, slower loops

### Recommended Settings

| Scenario | Window | Threshold |
|----------|--------|-----------|
| Tight budget control | 10 | 5.0 |
| Balanced (default) | 20 | 10.0 |
| Tolerant | 50 | 20.0 |

## When Kill Switch Triggers

1. Agent is set to `active = false`
2. Agent's `deactivated_by` is set to `'kill_switch'`
3. Event is recorded with `event_type: "kill_switch"`
4. Dashboard shows "Deactivated by Kill Switch" badge
5. Alert notification is sent (if configured)
6. Evidence payloads are archived for analysis

## Incidents Page

The **Incidents** page provides a detailed analysis of all Kill Switch events.

### Incidents List

Navigate to **Incidents** in the sidebar to see all Kill Switch events:

| Column | Description |
|--------|-------------|
| **Time** | When the Kill Switch was triggered |
| **Agent** | The affected agent |
| **Provider** | LLM provider in use |
| **Score** | Loop score vs threshold (e.g., "7.0/5") |
| **Window** | Detection window size used |
| **Signals** | Breakdown of detection signals (P=Prompts, R=Responses, T=ToolCalls) |

### Incident Detail

Click "View Details" to see the full analysis:

#### Scoring Breakdown

Visual breakdown of how the loop score was calculated:

```
Loop Score: 7.0 / 5.0 (140%)

[████████████████████████████░░░░░░|░░░░░░░░░░░░░░]
0                              Threshold          2x
```

The scoring table shows each signal's contribution:

| Signal | Count | Weight | Score |
|--------|-------|--------|-------|
| Similar Prompts | 3 | ×1.0 | 3.0 |
| Similar Responses | 2 | ×2.0 | 4.0 |
| Repeated Tool Calls | 0 | ×1.5 | 0.0 |
| **Total** | | | **7.0** |

#### Evidence Payloads

Collapsible list of the similar requests that triggered the Kill Switch. Each payload shows:

- **Request body** — The prompt sent to the LLM
- **Response body** — The LLM's response
- **Character count** — Size of each payload

This evidence helps you understand exactly what the agent was doing when it got stuck in a loop.

## Reactivation

To reactivate a killed agent:

1. Go to Agent Detail page
2. Toggle the **Active** switch to On
3. The loop detector window is automatically cleared
4. Agent resumes normal operation

::: warning Manual Review Recommended
Before reactivating, investigate why the agent was looping. Check the Request Log for repeated patterns.
:::

## Alert Integration

Kill Switch events trigger alerts automatically. To receive notifications:

1. Go to **Alerts** page
2. Configure webhook URL and/or email for the agent
3. When Kill Switch triggers, you'll receive an alert with:
   - Agent ID
   - Loop detection score
   - Deactivation timestamp

## API

Kill Switch configuration can also be managed via API:

```bash
# Get current config
GET /api/agents/:agentId/kill-switch

# Update config
PUT /api/agents/:agentId/kill-switch
{
  "enabled": true,
  "window_size": 20,
  "threshold": 10.0
}
```

## Comparison with Other Tools

| Feature | Langsmith | Langfuse | Helicone | AgentGazer |
|---------|:---------:|:--------:|:--------:|:----------:|
| Loop Detection | ❌ | ❌ | ❌ | ✅ |
| Auto-Deactivation | ❌ | ❌ | ❌ | ✅ |
| SimHash Similarity | ❌ | ❌ | ❌ | ✅ |

Other tools can only alert you about anomalies — you still have to manually stop the agent. AgentGazer stops it automatically.
